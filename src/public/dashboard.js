/* R Best Practices dashboard.
 * Talks to the same REST API the MCP server exposes; no AI or MCP client involved.
 * All API data is rendered with textContent/DOM nodes, never innerHTML. */
(function () {
  'use strict';

  var TABS = ['validate', 'detect', 'generate', 'practices', 'system'];
  var SEVERITIES = ['critical', 'important', 'recommended', 'info'];
  var SEV_STYLE = {
    critical: { label: 'Critical', badge: 'bg-red-100 text-red-900', border: 'border-l-red-500' },
    important: { label: 'Important', badge: 'bg-amber-100 text-amber-900', border: 'border-l-amber-500' },
    recommended: { label: 'Recommended', badge: 'bg-blue-100 text-blue-900', border: 'border-l-blue-500' },
    info: { label: 'Info', badge: 'bg-cyan-100 text-cyan-900', border: 'border-l-cyan-500' },
  };
  var WORKFLOWS = [
    { id: 'package', label: 'R package' },
    { id: 'shiny', label: 'Shiny app' },
    { id: 'quarto', label: 'Quarto document' },
    { id: 'rmarkdown', label: 'R Markdown document' },
    { id: 'targets', label: 'targets pipeline' },
    { id: 'renv', label: 'renv environment' },
    { id: 'plumber', label: 'Plumber API' },
    { id: 'r-script', label: 'R script' },
    { id: 'analysis', label: 'Data analysis project' },
    { id: 'bookdown', label: 'bookdown book' },
    { id: 'blogdown', label: 'blogdown site' },
    { id: 'shinytest', label: 'shinytest2 tests' },
  ];
  var CATEGORIES = ['structure', 'naming', 'documentation', 'performance', 'security', 'testing', 'dependency', 'style'];
  var SEVERITY_OPTIONS = [
    { value: '', label: 'All severities' },
    { value: 'info', label: 'Info and up' },
    { value: 'recommended', label: 'Recommended and up' },
    { value: 'important', label: 'Important and up' },
    { value: 'critical', label: 'Critical only' },
  ];
  var ENFORCEMENT = {
    automated: { label: 'Automated check', cls: 'bg-emerald-100 text-emerald-900', hint: 'A validator rule reports violations of this practice.' },
    guidance: { label: 'Guidance only', cls: 'bg-slate-100 text-slate-700', hint: 'Advice only; this practice is not checked automatically.' },
  };
  var MAX_FINDINGS_LIMIT = 1000;
  var PRACTICE_DEBOUNCE_MS = 250;
  var RECENT_KEY = 'rbp.recentPaths';

  var state = {
    practices: [],
    shownPractices: [],
    practiceSeq: 0,
    practiceAbort: null,
    practiceTimer: null,
    audit: null,
    sevFilter: {},
    template: null,
    templateName: '',
    selectedFile: null,
    toolsLoaded: false,
    practicesPromise: null,
    toastTimer: null,
  };

  /* ---------- helpers ---------- */

  function $(name) {
    return document.querySelector('[data-el="' + name + '"]');
  }

  function h(tag, props, children) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function icon(name, size) {
    return h('span', {
      class: 'material-symbols-outlined',
      style: 'font-size:' + (size || 16) + 'px',
      'aria-hidden': 'true',
      text: name,
    });
  }

  function clear(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function workflowLabel(id) {
    for (var i = 0; i < WORKFLOWS.length; i++) if (WORKFLOWS[i].id === id) return WORKFLOWS[i].label;
    return id === 'unknown' ? 'Unknown' : id;
  }

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many || one + 's');
  }

  function formatMs(ms) {
    if (typeof ms !== 'number' || isNaN(ms)) return '–';
    if (ms < 1000) return Math.round(ms) + ' ms';
    var s = Math.round(ms / 1000);
    if (s < 60) return s + ' s';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' min ' + (s % 60) + ' s';
    var hrs = Math.floor(m / 60);
    return hrs + ' h ' + (m % 60) + ' min';
  }

  function isHttpUrl(u) {
    return typeof u === 'string' && /^https?:\/\//i.test(u);
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* storage unavailable: feature degrades silently */
    }
  }

  function toast(message) {
    var el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(function () {
      el.classList.add('hidden');
    }, 2500);
  }

  function showAlert(message) {
    $('alert-text').textContent = message;
    $('alert').classList.remove('hidden');
  }

  function clearAlert() {
    $('alert').classList.add('hidden');
  }

  function setBusy(btn, busy, busyLabel) {
    if (!btn) return;
    var label = btn.querySelector('[data-el$="-label"]') || btn;
    if (busy) {
      btn.dataset.idleLabel = label.textContent;
      label.textContent = busyLabel;
      btn.disabled = true;
    } else {
      if (btn.dataset.idleLabel) label.textContent = btn.dataset.idleLabel;
      btn.disabled = false;
    }
  }

  function api(method, url, body, signal) {
    var opts = { method: method, headers: {} };
    if (signal) opts.signal = signal;
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(
      function (res) {
        return res.text().then(function (text) {
          var json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch (e) {
            json = null;
          }
          if (!res.ok || !json || json.error) {
            var msg =
              (json && json.message) ||
              (res.status === 429
                ? 'Too many requests. Please wait a moment and try again.'
                : 'Request failed (HTTP ' + res.status + ').');
            throw new Error(msg);
          }
          return json.data;
        });
      },
      function (err) {
        if (err && err.name === 'AbortError') {
          var aborted = new Error('Request cancelled');
          aborted.aborted = true;
          throw aborted;
        }
        throw new Error('Cannot reach the server. Is it still running?');
      },
    );
  }

  function download(filename, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function copyText(text, okMessage) {
    function fallback() {
      var ta = h('textarea', { style: 'position:fixed;opacity:0' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(ta);
      toast(ok ? okMessage : 'Copy failed. Select the text and copy it manually.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(okMessage);
      }, fallback);
    } else {
      fallback();
    }
  }

  function emptyBox(text) {
    return h('div', { class: 'text-center py-12 text-secondary border border-dashed border-border-strong rounded-xl', text: text });
  }

  function badge(text, cls, title) {
    return h('span', { class: 'px-2 py-0.5 rounded text-[11px] font-semibold ' + cls, title: title, text: text });
  }

  /* ---------- tabs ---------- */

  function showTab(name, updateHash) {
    if (TABS.indexOf(name) < 0) name = 'validate';
    TABS.forEach(function (t) {
      var btn = document.getElementById('tab-' + t);
      var panel = document.getElementById('panel-' + t);
      var active = t === name;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.setAttribute('tabindex', active ? '0' : '-1');
      panel.hidden = !active;
    });
    if (updateHash !== false && window.location.hash.replace('#', '').split('/')[0] !== name) {
      window.history.replaceState(null, '', '#' + name);
    }
    if (name === 'practices') loadPractices();
    if (name === 'system') {
      refreshStatus();
      loadTools();
    }
  }

  function routeFromHash() {
    var parts = window.location.hash.replace('#', '').split('/');
    showTab(parts[0] || 'validate', false);
    if (parts[0] === 'practices' && parts[1]) {
      loadPractices().then(function () {
        openPractice(decodeURIComponent(parts[1]));
      });
    }
  }

  /* ---------- server status ---------- */

  function refreshStatus() {
    return fetch('/health')
      .then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      })
      .then(function (data) {
        var m = data.metrics || {};
        $('status-dot').className = 'w-2 h-2 rounded-full bg-emerald-500';
        $('status-text').textContent = 'Online';
        $('version').textContent = 'v' + data.version;
        $('stat-server').textContent = 'Online';
        $('stat-server-sub').textContent = 'up ' + formatMs(m.uptime);
        renderHealth(data);
      })
      .catch(function () {
        $('status-dot').className = 'w-2 h-2 rounded-full bg-red-500';
        $('status-text').textContent = 'Offline';
        $('stat-server').textContent = 'Offline';
        $('stat-server-sub').textContent = 'cannot reach the server';
        var grid = $('health-grid');
        clear(grid);
        grid.appendChild(emptyBox('The server is not reachable.'));
      });
  }

  function renderHealth(data) {
    var m = data.metrics || {};
    var items = [
      ['Status', data.status],
      ['Service', data.service],
      ['Version', data.version],
      ['Uptime', formatMs(m.uptime)],
      ['Average request', m.averageRequestDuration],
      ['Requests handled', String(m.totalRequests)],
      ['Server time', new Date(data.timestamp).toLocaleTimeString()],
    ];
    var grid = $('health-grid');
    clear(grid);
    items.forEach(function (it) {
      grid.appendChild(
        h('div', { class: 'rounded-xl border border-border-subtle bg-surface-canvas p-3' }, [
          h('dt', { class: 'text-label-md font-label-md text-secondary', text: it[0] }),
          h('dd', { class: 'text-headline-sm font-headline-sm text-on-surface break-words', text: it[1] }),
        ]),
      );
    });

    var counts = m.operationCounts || {};
    var errors = m.errorCounts || {};
    var names = Object.keys(counts);
    var body = $('ops-body');
    clear(body);
    if (!names.length) {
      body.appendChild(
        h('tr', null, [h('td', { colspan: '3', class: 'px-3 py-3 text-secondary', text: 'No operations yet.' })]),
      );
    }
    names.sort().forEach(function (n) {
      body.appendChild(
        h('tr', { class: 'border-t border-border-subtle' }, [
          h('td', { class: 'px-3 py-2 font-code-md', text: n }),
          h('td', { class: 'px-3 py-2', text: String(counts[n]) }),
          h('td', { class: 'px-3 py-2', text: String(errors[n] || 0) }),
        ]),
      );
    });
  }

  function loadTools() {
    if (state.toolsLoaded) return;
    state.toolsLoaded = true;
    api('GET', '/api/tools').then(
      function (tools) {
        var list = $('tools-list');
        clear(list);
        (tools || []).forEach(function (t) {
          var params = Object.keys(t.parameters || {}).map(function (k) {
            var p = t.parameters[k];
            return h('li', null, [
              h('code', { class: 'font-code-sm', text: k }),
              ' (' + p.type + (p.required ? ', required' : '') + '): ' + (p.description || '') +
                (p.enum ? ' [' + p.enum.join(' | ') + ']' : ''),
            ]);
          });
          list.appendChild(
            h('div', { class: 'rounded-xl border border-border-subtle p-4 space-y-2' }, [
              h('div', { class: 'flex items-center gap-2 flex-wrap' }, [
                badge(t.method, t.method === 'GET' ? 'bg-emerald-100 text-emerald-900' : 'bg-blue-100 text-blue-900'),
                h('code', { class: 'font-code-md text-on-surface break-all', text: t.path }),
              ]),
              h('div', { class: 'text-body-sm font-body-sm text-secondary', text: t.description }),
              params.length ? h('ul', { class: 'list-disc pl-5 text-label-md font-label-md text-secondary' }, params) : null,
            ]),
          );
        });
      },
      function (err) {
        state.toolsLoaded = false;
        showAlert(err.message);
      },
    );
  }

  /* ---------- recent paths ---------- */

  function recentPaths() {
    try {
      var list = JSON.parse(storageGet(RECENT_KEY) || '[]');
      return Array.isArray(list) ? list.filter(function (p) { return typeof p === 'string'; }) : [];
    } catch (e) {
      return [];
    }
  }

  function renderRecent() {
    var dl = document.getElementById('recent-paths');
    clear(dl);
    recentPaths().forEach(function (p) {
      dl.appendChild(h('option', { value: p }));
    });
  }

  function rememberPath(p) {
    var list = recentPaths().filter(function (x) { return x !== p; });
    list.unshift(p);
    storageSet(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
    renderRecent();
  }

  function setSharedPath(value) {
    var inputs = document.querySelectorAll('[data-input="project-path"]');
    for (var i = 0; i < inputs.length; i++) inputs[i].value = value;
  }

  /* ---------- validate ---------- */

  function populateWorkflowSelects() {
    var audit = $('audit-workflow');
    audit.appendChild(h('option', { value: '', text: 'Auto-detect (recommended)' }));
    var gen = $('gen-workflow');
    WORKFLOWS.forEach(function (w) {
      audit.appendChild(h('option', { value: w.id, text: w.label }));
      gen.appendChild(h('option', { value: w.id, text: w.label }));
    });
    $('stat-workflows').textContent = String(WORKFLOWS.length);
    populateSeveritySelect($('filter-min-severity'));
    populateSeveritySelect($('practice-severity'));
    var box = $('filter-categories');
    CATEGORIES.forEach(function (c) {
      var id = 'filter-cat-' + c;
      box.appendChild(
        h('label', { for: id, class: 'inline-flex items-center gap-1.5 text-label-md font-label-md text-on-surface' }, [
          h('input', { type: 'checkbox', id: id, value: c, 'data-filter-category': '', class: 'rounded border-border-strong' }),
          c,
        ]),
      );
    });
  }

  function populateSeveritySelect(select) {
    SEVERITY_OPTIONS.forEach(function (o) {
      select.appendChild(h('option', { value: o.value, text: o.label }));
    });
  }

  /* Server-side filters from the "Filters" block; applied to project audits and single files.
   * Returns { filters: {...} } or { error: 'message' }. */
  function readAuditFilters() {
    var filters = {};
    var sev = $('filter-min-severity').value;
    if (sev) filters.minSeverity = sev;
    var cats = [];
    document.querySelectorAll('[data-filter-category]').forEach(function (cb) {
      if (cb.checked) cats.push(cb.value);
    });
    if (cats.length) filters.categories = cats;
    var raw = $('filter-max').value.trim();
    if (raw) {
      var n = Number(raw);
      if (!/^\d+$/.test(raw) || n < 1 || n > MAX_FINDINGS_LIMIT) {
        return { error: 'Max findings must be a whole number between 1 and ' + MAX_FINDINGS_LIMIT + ', or left blank for no limit.' };
      }
      filters.maxFindings = n;
    }
    return { filters: filters };
  }

  function describeFilters(f) {
    var parts = [];
    if (f.minSeverity) parts.push('minimum severity ' + f.minSeverity);
    if (f.categories) parts.push('categories ' + f.categories.join(', '));
    if (f.maxFindings) parts.push('max ' + f.maxFindings + ' findings');
    return parts.length ? parts.join('; ') : 'none';
  }

  function updateFiltersBadge() {
    var read = readAuditFilters();
    var n = read.filters ? Object.keys(read.filters).length : 0;
    var el = $('filters-badge');
    el.textContent = n ? n + ' active' : '';
    el.classList.toggle('hidden', !n);
  }

  function resetAuditFilters() {
    $('filter-min-severity').value = '';
    $('filter-max').value = '';
    document.querySelectorAll('[data-filter-category]').forEach(function (cb) {
      cb.checked = false;
    });
    updateFiltersBadge();
  }

  function runAudit(path, workflow) {
    clearAlert();
    if (!path) {
      showAlert('Enter the path of the project folder first.');
      return Promise.resolve();
    }
    var read = readAuditFilters();
    if (read.error) {
      showAlert(read.error);
      return Promise.resolve();
    }
    var btn = $('audit-btn');
    setBusy(btn, true, 'Auditing…');
    var body = Object.assign({ path: path }, read.filters);
    if (workflow) body.workflow = workflow;
    return api('POST', '/api/validate-project', body).then(
      function (result) {
        rememberPath(path);
        state.audit = { kind: 'project', target: path, result: result, filters: read.filters };
        state.sevFilter = {};
        $('finding-category').value = '';
        $('finding-text').value = '';
        setBusy(btn, false);
        renderAudit();
      },
      function (err) {
        setBusy(btn, false);
        showAlert(err.message);
      },
    );
  }

  function runFileValidation(path) {
    clearAlert();
    if (!path) {
      showAlert('Enter the path of the file first.');
      return Promise.resolve();
    }
    var read = readAuditFilters();
    if (read.error) {
      showAlert(read.error);
      return Promise.resolve();
    }
    var btn = $('file-btn');
    var started = window.performance.now();
    setBusy(btn, true, 'Validating…');
    return api('POST', '/api/validate-file', Object.assign({ path: path }, read.filters)).then(
      function (data) {
        state.audit = {
          kind: 'file',
          target: data.path || path,
          filters: read.filters,
          result: {
            filePath: data.path || path,
            workflow: 'file',
            findings: data.findings || [],
            summary: data.summary,
            duration: window.performance.now() - started,
          },
        };
        state.sevFilter = {};
        $('finding-category').value = '';
        $('finding-text').value = '';
        setBusy(btn, false);
        renderAudit();
      },
      function (err) {
        setBusy(btn, false);
        showAlert(err.message);
      },
    );
  }

  function severityRank(s) {
    var i = SEVERITIES.indexOf(s);
    return i < 0 ? SEVERITIES.length : i;
  }

  function relativeTo(base, file) {
    if (!file) return '';
    var b = String(base || '').replace(/\/+$/, '');
    return b && file.indexOf(b + '/') === 0 ? file.slice(b.length + 1) : file;
  }

  function filteredFindings() {
    var all = (state.audit && state.audit.result.findings) || [];
    var activeSev = Object.keys(state.sevFilter).filter(function (k) { return state.sevFilter[k]; });
    var cat = $('finding-category').value;
    var q = $('finding-text').value.trim().toLowerCase();
    return all
      .filter(function (f) {
        if (activeSev.length && activeSev.indexOf(f.severity) < 0) return false;
        if (cat && f.category !== cat) return false;
        if (!q) return true;
        var hay = [f.id, f.message, f.details, f.file, (f.suggestions || []).join(' ')].join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      })
      .sort(function (a, b) {
        return severityRank(a.severity) - severityRank(b.severity) || String(a.file).localeCompare(String(b.file));
      });
  }

  function renderAudit() {
    var audit = state.audit;
    var result = audit.result;
    var all = result.findings || [];
    var totalFound = result.summary && typeof result.summary.total === 'number' ? result.summary.total : all.length;
    var counts = {};
    all.forEach(function (f) {
      counts[f.severity] = (counts[f.severity] || 0) + 1;
    });

    var summary =
      audit.kind === 'file'
        ? 'File ' + audit.target
        : workflowLabel(result.workflow) + ' project · ' + audit.target;
    $('findings-summary').textContent =
      summary +
      ' · ' +
      (result.summary ? 'Showing ' + all.length + ' of ' + plural(totalFound, 'finding') : plural(all.length, 'finding')) +
      ' · ' +
      formatMs(result.duration);
    $('findings-actions').classList.remove('hidden');
    $('findings-filters').classList.toggle('hidden', all.length === 0);

    var badgeEl = $('issue-badge');
    badgeEl.textContent = String(all.length);
    badgeEl.classList.remove('hidden');
    $('stat-audit').textContent = String(all.length);
    $('stat-audit-sub').textContent = all.length
      ? SEVERITIES.filter(function (s) { return counts[s]; })
          .map(function (s) { return counts[s] + ' ' + s; })
          .join(' · ')
      : totalFound
        ? 'none shown (' + totalFound + ' hidden by filters)'
        : 'no issues found';
    if (all.length && totalFound > all.length) {
      $('stat-audit-sub').textContent += ' · ' + (totalFound - all.length) + ' hidden by filters';
    }

    var chips = $('severity-chips');
    clear(chips);
    SEVERITIES.forEach(function (s) {
      if (!counts[s]) return;
      var on = !!state.sevFilter[s];
      chips.appendChild(
        h('button', {
          type: 'button',
          'aria-pressed': on ? 'true' : 'false',
          class:
            'px-2.5 py-1 rounded text-label-md font-label-md font-bold border ' +
            SEV_STYLE[s].badge +
            (on ? ' border-current' : ' border-transparent opacity-70 hover:opacity-100'),
          text: counts[s] + ' ' + SEV_STYLE[s].label,
          onclick: function () {
            state.sevFilter[s] = !state.sevFilter[s];
            renderAudit();
          },
        }),
      );
    });

    var catSelect = $('finding-category');
    var currentCat = catSelect.value;
    var cats = [];
    all.forEach(function (f) {
      if (f.category && cats.indexOf(f.category) < 0) cats.push(f.category);
    });
    clear(catSelect);
    catSelect.appendChild(h('option', { value: '', text: 'All categories' }));
    cats.sort().forEach(function (c) {
      catSelect.appendChild(h('option', { value: c, text: c }));
    });
    catSelect.value = cats.indexOf(currentCat) >= 0 ? currentCat : '';

    renderFindingList(all.length);
  }

  function renderFindingList(total) {
    var list = $('findings');
    clear(list);
    if (total === 0 && state.audit.result.summary && state.audit.result.summary.total > 0) {
      list.appendChild(emptyBox('All ' + plural(state.audit.result.summary.total, 'finding') + ' were hidden by the audit filters. Adjust or reset the filters and run the audit again.'));
      return;
    }
    if (total === 0) {
      list.appendChild(
        h('div', { class: 'text-center py-12 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900' }, [
          h('div', { class: 'font-semibold', text: 'No issues found' }),
          h('div', { class: 'text-body-sm font-body-sm', text: 'Nothing to fix for the checks that apply to this target.' }),
        ]),
      );
      return;
    }
    var findings = filteredFindings();
    if (!findings.length) {
      list.appendChild(emptyBox('No findings match the current filters.'));
      return;
    }
    findings.forEach(function (f) {
      list.appendChild(findingCard(f));
    });
  }

  function findingCard(f) {
    var style = SEV_STYLE[f.severity] || SEV_STYLE.info;
    var practice = null;
    for (var i = 0; i < state.practices.length; i++) {
      if (state.practices[i].id === f.id) practice = state.practices[i];
    }
    var location = f.file ? relativeTo(state.audit.target, f.file) + (f.line ? ':' + f.line : '') : '';
    return h('article', { class: 'bg-surface-card rounded-xl p-4 border border-border-subtle border-l-4 shadow-sm ' + style.border }, [
      h('div', { class: 'flex items-center gap-2 flex-wrap' }, [
        badge(style.label.toUpperCase(), style.badge),
        f.category ? badge(f.category, 'bg-slate-100 text-slate-700') : null,
        location ? h('code', { class: 'font-code-sm text-secondary break-all', text: location }) : null,
      ]),
      h('h3', { class: 'text-headline-sm font-headline-sm text-on-surface mt-2 break-words', text: f.message }),
      f.details ? h('p', { class: 'text-body-sm font-body-sm text-secondary mt-1 break-words', text: f.details }) : null,
      f.suggestions && f.suggestions.length
        ? h(
            'ul',
            { class: 'list-disc pl-5 mt-2 text-body-sm font-body-sm text-on-surface space-y-0.5' },
            f.suggestions.map(function (s) {
              return h('li', { class: 'break-words', text: s });
            }),
          )
        : null,
      h('div', { class: 'mt-3 flex items-center gap-3 flex-wrap text-label-md font-label-md' }, [
        h('code', { class: 'font-code-sm text-secondary', text: f.id }),
        practice
          ? h('button', { type: 'button', class: 'text-primary font-semibold hover:underline', text: 'View practice', onclick: function () { openPractice(practice.id); } })
          : null,
        isHttpUrl(f.link)
          ? h('a', { href: f.link, target: '_blank', rel: 'noopener noreferrer', class: 'text-primary font-semibold hover:underline', text: 'Learn more' })
          : null,
      ]),
    ]);
  }

  function auditReportJson() {
    var a = state.audit;
    return JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        target: a.target,
        kind: a.kind,
        workflow: a.result.workflow,
        durationMs: a.result.duration,
        filters: a.filters || {},
        summary: a.result.summary || null,
        findings: a.result.findings,
      },
      null,
      2,
    );
  }

  function auditReportMarkdown() {
    var a = state.audit;
    var findings = a.result.findings.slice().sort(function (x, y) {
      return severityRank(x.severity) - severityRank(y.severity);
    });
    var lines = [
      '# R Best Practices report',
      '',
      '- Target: `' + a.target + '`',
      '- Workflow: ' + (a.kind === 'file' ? 'single file' : workflowLabel(a.result.workflow)),
      '- Generated: ' + new Date().toISOString(),
      '- Findings: ' +
        (a.result.summary ? findings.length + ' shown of ' + a.result.summary.total : findings.length),
      '- Filters: ' + describeFilters(a.filters || {}),
    ];
    if (a.result.summary) {
      var sm = a.result.summary;
      lines.push(
        '- Summary (all findings before filters): ' +
          SEVERITIES.map(function (sv) { return (sm.bySeverity[sv] || 0) + ' ' + sv; }).join(', '),
      );
    }
    lines.push('');
    if (!findings.length) {
      lines.push(a.result.summary && a.result.summary.total ? 'No findings match the filters used.' : 'No issues found.');
    }
    findings.forEach(function (f) {
      var where = f.file ? ' (`' + relativeTo(a.target, f.file) + (f.line ? ':' + f.line : '') + '`)' : '';
      lines.push('## [' + f.severity.toUpperCase() + '] ' + f.message + where, '');
      lines.push('- Rule: `' + f.id + '`' + (f.category ? ' · ' + f.category : ''));
      if (f.details) lines.push('- ' + f.details);
      (f.suggestions || []).forEach(function (s) {
        lines.push('- Suggestion: ' + s);
      });
      lines.push('');
    });
    return lines.join('\n');
  }

  /* ---------- detect ---------- */

  function runDetect(path) {
    clearAlert();
    if (!path) {
      showAlert('Enter the path of the project folder first.');
      return Promise.resolve();
    }
    var btn = $('detect-btn');
    setBusy(btn, true, 'Detecting…');
    return api('POST', '/api/detect-workflow', { path: path }).then(
      function (result) {
        rememberPath(path);
        setBusy(btn, false);
        renderDetect(path, result);
      },
      function (err) {
        setBusy(btn, false);
        showAlert(err.message);
      },
    );
  }

  function renderDetect(path, result) {
    var box = $('detect-result');
    clear(box);
    var known = WORKFLOWS.some(function (w) { return w.id === result.workflow; });
    var confidence = Math.max(0, Math.min(100, Number(result.confidence) || 0));
    var indicators = result.indicators || [];
    box.appendChild(
      h('div', { class: 'rounded-xl border border-border-subtle bg-surface-canvas p-5 space-y-4' }, [
        h('div', null, [
          h('div', { class: 'text-label-md font-label-md text-secondary', text: 'DETECTED WORKFLOW' }),
          h('div', { class: 'text-headline-lg font-headline-lg text-on-surface', text: workflowLabel(result.workflow) }),
          h('code', { class: 'font-code-sm text-secondary break-all', text: path }),
        ]),
        h('div', null, [
          h('div', { class: 'flex justify-between text-label-md font-label-md mb-1' }, [
            h('span', { text: 'Confidence' }),
            h('span', { class: 'font-bold text-primary', text: confidence + '%' }),
          ]),
          h('div', { class: 'w-full h-3 bg-slate-100 rounded-full overflow-hidden', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(confidence) }, [
            h('div', { class: 'h-full bg-gradient-to-r from-cyan-400 to-primary', style: 'width:' + confidence + '%' }),
          ]),
        ]),
        h('div', null, [
          h('div', { class: 'text-label-md font-label-md text-secondary mb-1', text: 'EVIDENCE' }),
          indicators.length
            ? h(
                'ul',
                { class: 'list-disc pl-5 text-body-sm font-body-sm space-y-0.5' },
                indicators.map(function (i) {
                  return h('li', { class: 'break-words', text: i });
                }),
              )
            : h('p', { class: 'text-body-sm font-body-sm text-secondary', text: 'No workflow-specific files were found in this folder.' }),
        ]),
        known
          ? h('div', { class: 'flex flex-wrap gap-2 pt-2' }, [
              h('button', {
                type: 'button',
                class: 'px-3 py-1.5 rounded-lg bg-primary text-white text-label-md font-label-md font-semibold hover:opacity-90',
                text: 'Validate as ' + workflowLabel(result.workflow),
                onclick: function () {
                  setSharedPath(path);
                  $('audit-workflow').value = result.workflow;
                  showTab('validate');
                  runAudit(path, result.workflow);
                },
              }),
              h('button', {
                type: 'button',
                class: 'px-3 py-1.5 rounded-lg border border-border-strong text-label-md font-label-md hover:bg-white',
                text: 'Generate a ' + workflowLabel(result.workflow) + ' template',
                onclick: function () {
                  $('gen-workflow').value = result.workflow;
                  showTab('generate');
                },
              }),
            ])
          : h('p', { class: 'text-body-sm font-body-sm text-secondary', text: 'The workflow could not be identified. Check the path, or generate a template to start from a known structure.' }),
      ]),
    );
  }

  /* ---------- generate ---------- */

  function slug(s) {
    return String(s || '').trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function safeEntryPath(p) {
    var parts = String(p).replace(/\\/g, '/').split('/').filter(function (x) { return x && x !== '.' && x !== '..'; });
    return parts.join('/');
  }

  function runGenerate() {
    clearAlert();
    var workflow = $('gen-workflow').value;
    var btn = $('gen-btn');
    var body = { workflow: workflow };
    var name = $('gen-name').value.trim();
    var author = $('gen-author').value.trim();
    var email = $('gen-email').value.trim();
    if (name) body.projectName = name;
    if (author) body.authorName = author;
    if (email) body.authorEmail = email;
    setBusy(btn, true, 'Generating…');
    return api('POST', '/api/generate-template', body).then(
      function (tpl) {
        setBusy(btn, false);
        state.template = tpl;
        state.templateName = slug(name) || workflow + '-template';
        state.selectedFile = null;
        renderTemplate();
      },
      function (err) {
        setBusy(btn, false);
        showAlert(err.message);
      },
    );
  }

  function renderTemplate() {
    var tpl = state.template;
    var files = (tpl.files || []).slice().sort(function (a, b) { return a.path.localeCompare(b.path); });
    var dirSet = {};
    (tpl.directories || []).forEach(function (d) { dirSet[safeEntryPath(d)] = true; });
    files.forEach(function (f) {
      var parts = safeEntryPath(f.path).split('/');
      parts.pop();
      for (var i = 1; i <= parts.length; i++) dirSet[parts.slice(0, i).join('/')] = true;
    });
    var dirs = Object.keys(dirSet).filter(Boolean);

    $('gen-empty').classList.add('hidden');
    $('gen-result').classList.remove('hidden');
    $('gen-title').textContent = workflowLabel(tpl.workflow) + ' template';
    $('gen-sub').textContent = plural(files.length, 'file') + ' · ' + plural(dirs.length, 'folder');

    var entries = dirs
      .map(function (d) { return { path: d, dir: true }; })
      .concat(files.map(function (f) { return { path: safeEntryPath(f.path), dir: false, file: f }; }))
      .sort(function (a, b) {
        var ap = a.dir ? a.path + '/' : a.path;
        var bp = b.dir ? b.path + '/' : b.path;
        return ap.localeCompare(bp);
      });

    var tree = $('gen-tree');
    clear(tree);
    entries.forEach(function (e) {
      var depth = e.path.split('/').length - 1;
      var name = e.path.split('/').pop();
      var row = e.dir
        ? h('div', { class: 'flex items-center gap-1 py-0.5 text-secondary', style: 'padding-left:' + depth * 14 + 'px' }, [icon('folder', 16), h('span', { text: name })])
        : h(
            'button',
            {
              type: 'button',
              'data-file': e.path,
              class: 'w-full text-left flex items-center gap-1 py-0.5 rounded hover:bg-white',
              style: 'padding-left:' + depth * 14 + 'px',
              onclick: function () { selectFile(e.file); },
            },
            [icon('description', 16), h('span', { class: 'truncate', text: name })],
          );
      tree.appendChild(h('li', null, [row]));
    });

    var first = null;
    for (var i = 0; i < files.length && !first; i++) if (/readme/i.test(files[i].path)) first = files[i];
    selectFile(first || files[0] || null);
  }

  function selectFile(file) {
    state.selectedFile = file;
    var buttons = document.querySelectorAll('[data-el="gen-tree"] [data-file]');
    for (var i = 0; i < buttons.length; i++) {
      var on = file && buttons[i].getAttribute('data-file') === safeEntryPath(file.path);
      buttons[i].classList.toggle('bg-white', !!on);
      buttons[i].classList.toggle('font-semibold', !!on);
    }
    $('gen-file-name').textContent = file ? file.path : 'No files in this template';
    $('gen-file-content').textContent = file ? file.content : '';
  }

  /* Minimal ZIP writer (stored, no compression) so no library is needed. */
  var CRC_TABLE = (function () {
    var t = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function buildZip(entries) {
    var enc = new TextEncoder();
    var now = new Date();
    var dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
    var dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
    var parts = [];
    var central = [];
    var offset = 0;
    entries.forEach(function (e) {
      var name = enc.encode(e.name);
      var data = e.data || new Uint8Array(0);
      var crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(10, dosTime, true);
      lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true);
      ch.setUint32(38, e.data ? 0 : 0x10, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var centralSize = 0;
    central.forEach(function (c) { centralSize += c.length; });
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }

  function downloadZip() {
    var tpl = state.template;
    if (!tpl) return;
    var enc = new TextEncoder();
    var root = state.templateName;
    var seen = {};
    var entries = [{ name: root + '/', data: null }];
    seen[root + '/'] = true;
    function addDir(path) {
      var parts = path.split('/');
      for (var i = 1; i <= parts.length; i++) {
        var d = root + '/' + parts.slice(0, i).join('/') + '/';
        if (!seen[d]) {
          seen[d] = true;
          entries.push({ name: d, data: null });
        }
      }
    }
    (tpl.directories || []).forEach(function (d) {
      var p = safeEntryPath(d);
      if (p) addDir(p);
    });
    (tpl.files || []).forEach(function (f) {
      var p = safeEntryPath(f.path);
      if (!p) return;
      var dirPart = p.split('/').slice(0, -1).join('/');
      if (dirPart) addDir(dirPart);
      entries.push({ name: root + '/' + p, data: enc.encode(f.content) });
    });
    download(root + '.zip', buildZip(entries), 'application/zip');
  }

  /* ---------- practices ---------- */

  /* One unfiltered load feeds the dropdown options, the stat card and "View practice" links.
   * The visible list is filtered by the server (see refreshPractices). */
  function loadPractices() {
    if (state.practicesPromise) return state.practicesPromise;
    state.practicesPromise = api('GET', '/api/practices').then(
      function (data) {
        state.practices = data.practices || [];
        var wfs = [];
        var cats = [];
        var automated = 0;
        var guidance = 0;
        state.practices.forEach(function (p) {
          if (wfs.indexOf(p.workflow) < 0) wfs.push(p.workflow);
          if (cats.indexOf(p.category) < 0) cats.push(p.category);
          if (p.enforcement === 'automated') automated++;
          else if (p.enforcement === 'guidance') guidance++;
        });
        wfs.sort().forEach(function (w) {
          $('practice-workflow').appendChild(h('option', { value: w, text: workflowLabel(w) }));
        });
        cats.sort().forEach(function (c) {
          $('practice-category').appendChild(h('option', { value: c, text: c }));
        });
        $('stat-practices').textContent = String(state.practices.length);
        $('stat-practices-sub').textContent =
          automated || guidance
            ? automated + ' automated · ' + guidance + ' guidance'
            : 'across ' + plural(cats.length, 'category', 'categories');
        if (practiceFilterParams()) {
          refreshPractices();
        } else {
          state.shownPractices = state.practices;
          renderPractices();
        }
        if (state.audit) renderAudit();
      },
      function (err) {
        state.practicesPromise = null;
        $('practice-count').textContent = 'Could not load practices.';
        showAlert(err.message);
      },
    );
    return state.practicesPromise;
  }

  /* Query string for /api/practices from the filter controls, or '' when nothing is set. */
  function practiceFilterParams() {
    var pairs = [];
    [
      ['workflow', 'practice-workflow'],
      ['category', 'practice-category'],
      ['minSeverity', 'practice-severity'],
      ['enforcement', 'practice-enforcement'],
    ].forEach(function (m) {
      var v = $(m[1]).value;
      if (v) pairs.push(m[0] + '=' + encodeURIComponent(v));
    });
    var q = $('practice-text').value.trim();
    if (q) pairs.push('q=' + encodeURIComponent(q));
    return pairs.join('&');
  }

  /* Ask the server for the filtered list. Only the newest request may update the page. */
  function refreshPractices() {
    window.clearTimeout(state.practiceTimer);
    var seq = ++state.practiceSeq;
    if (state.practiceAbort) state.practiceAbort.abort();
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    state.practiceAbort = ctrl;
    var params = practiceFilterParams();
    $('practice-list').setAttribute('aria-busy', 'true');
    return api('GET', '/api/practices' + (params ? '?' + params : ''), undefined, ctrl ? ctrl.signal : undefined).then(
      function (data) {
        if (seq !== state.practiceSeq) return;
        $('practice-list').removeAttribute('aria-busy');
        state.shownPractices = data.practices || [];
        renderPractices();
      },
      function (err) {
        if (err.aborted || seq !== state.practiceSeq) return;
        $('practice-list').removeAttribute('aria-busy');
        showAlert(err.message);
      },
    );
  }

  function schedulePracticeRefresh() {
    window.clearTimeout(state.practiceTimer);
    state.practiceTimer = window.setTimeout(refreshPractices, PRACTICE_DEBOUNCE_MS);
  }

  /* Clear every practice filter without a server round trip (an empty filter is the full list). */
  function resetPracticeFilters() {
    ['practice-text', 'practice-workflow', 'practice-category', 'practice-severity', 'practice-enforcement'].forEach(function (n) {
      $(n).value = '';
    });
    window.clearTimeout(state.practiceTimer);
    state.practiceSeq++;
    if (state.practiceAbort) state.practiceAbort.abort();
    $('practice-list').removeAttribute('aria-busy');
    state.shownPractices = state.practices;
    renderPractices();
  }

  function codeBlock(label, code, tone) {
    return h('div', null, [
      h('div', { class: 'text-label-md font-label-md font-semibold ' + tone, text: label }),
      h('pre', { class: 'mt-1 p-3 rounded-lg bg-slate-900 text-slate-100 text-code-md font-code-md overflow-auto custom-scroll' }, [h('code', { text: code })]),
    ]);
  }

  function renderPractices() {
    var list = $('practice-list');
    clear(list);
    var items = state.shownPractices;
    $('practice-count').textContent = 'Showing ' + items.length + ' of ' + state.practices.length + ' practices';
    if (!items.length) {
      list.appendChild(emptyBox('No practices match your filters.'));
      return;
    }
    items.forEach(function (p) {
      var style = SEV_STYLE[p.severity] || SEV_STYLE.info;
      var refs = (p.references || []).filter(isHttpUrl);
      list.appendChild(
        h('details', { 'data-practice-id': p.id, class: 'group rounded-xl border border-border-subtle bg-surface-canvas p-4' }, [
          h('summary', { class: 'cursor-pointer list-none' }, [
            h('div', { class: 'flex items-start justify-between gap-2' }, [
              h('h3', { class: 'text-headline-sm font-headline-sm text-on-surface', text: p.title }),
              icon('expand_more', 20),
            ]),
            h('div', { class: 'flex flex-wrap gap-1.5 mt-2' }, [
              badge(style.label, style.badge),
              ENFORCEMENT[p.enforcement]
                ? badge(ENFORCEMENT[p.enforcement].label, ENFORCEMENT[p.enforcement].cls, ENFORCEMENT[p.enforcement].hint)
                : null,
              badge(workflowLabel(p.workflow), 'bg-slate-100 text-slate-700'),
              badge(p.category, 'bg-slate-100 text-slate-700'),
            ]),
            h('p', { class: 'text-body-sm font-body-sm text-secondary mt-2', text: p.description }),
          ]),
          h('div', { class: 'mt-3 space-y-3' }, [
            p.details ? h('p', { class: 'text-body-sm font-body-sm text-on-surface break-words', text: p.details }) : null,
            p.badExample ? codeBlock('Avoid', p.badExample, 'text-red-700') : null,
            p.goodExample ? codeBlock('Prefer', p.goodExample, 'text-emerald-700') : null,
            p.tags && p.tags.length
              ? h('div', { class: 'flex flex-wrap gap-1.5' }, p.tags.map(function (t) { return badge('#' + t, 'bg-white border border-border-subtle text-secondary'); }))
              : null,
            refs.length
              ? h(
                  'ul',
                  { class: 'list-disc pl-5 text-label-md font-label-md' },
                  refs.map(function (r) {
                    return h('li', null, [h('a', { href: r, target: '_blank', rel: 'noopener noreferrer', class: 'text-primary hover:underline break-all', text: r })]);
                  }),
                )
              : null,
            h('code', { class: 'block font-code-sm text-secondary', text: p.id }),
          ]),
        ]),
      );
    });
  }

  function openPractice(id) {
    showTab('practices');
    loadPractices().then(function () {
      resetPracticeFilters();
      var card = null;
      document.querySelectorAll('[data-practice-id]').forEach(function (el) {
        if (el.getAttribute('data-practice-id') === id) card = el;
      });
      if (card) {
        card.open = true;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        toast('That practice is not in the knowledge base.');
      }
    });
  }

  /* ---------- wiring ---------- */

  function pathFrom(form) {
    return form.querySelector('[data-input="project-path"]').value.trim();
  }

  function init() {
    $('year').textContent = String(new Date().getFullYear());
    populateWorkflowSelects();
    renderRecent();
    var recent = recentPaths();
    if (recent.length) setSharedPath(recent[0]);

    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showTab(btn.getAttribute('data-tab'));
      });
      btn.addEventListener('keydown', function (e) {
        var i = TABS.indexOf(btn.getAttribute('data-tab'));
        var next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
        if (next === null) return;
        e.preventDefault();
        var target = TABS[(next + TABS.length) % TABS.length];
        showTab(target);
        document.getElementById('tab-' + target).focus();
      });
    });
    window.addEventListener('hashchange', routeFromHash);

    document.querySelectorAll('[data-input="project-path"]').forEach(function (input) {
      input.addEventListener('input', function () {
        setSharedPath(input.value);
      });
    });

    document.querySelector('[data-form="audit"]').addEventListener('submit', function (e) {
      e.preventDefault();
      runAudit(pathFrom(e.currentTarget), $('audit-workflow').value);
    });
    document.querySelector('[data-form="file"]').addEventListener('submit', function (e) {
      e.preventDefault();
      runFileValidation(document.getElementById('file-path').value.trim());
    });
    document.querySelector('[data-form="detect"]').addEventListener('submit', function (e) {
      e.preventDefault();
      runDetect(pathFrom(e.currentTarget));
    });
    document.querySelector('[data-form="generate"]').addEventListener('submit', function (e) {
      e.preventDefault();
      runGenerate();
    });

    $('finding-category').addEventListener('change', function () {
      if (state.audit) renderFindingList(state.audit.result.findings.length);
    });
    $('finding-text').addEventListener('input', function () {
      if (state.audit) renderFindingList(state.audit.result.findings.length);
    });
    $('practice-text').addEventListener('input', schedulePracticeRefresh);
    ['practice-workflow', 'practice-category', 'practice-severity', 'practice-enforcement'].forEach(function (n) {
      $(n).addEventListener('change', refreshPractices);
    });
    ['filter-min-severity', 'filter-max'].forEach(function (n) {
      $(n).addEventListener('input', updateFiltersBadge);
    });
    $('filter-categories').addEventListener('change', updateFiltersBadge);

    var actions = {
      'dismiss-alert': clearAlert,
      'refresh-status': function () {
        refreshStatus().then(function () {
          toast('Status refreshed');
        });
      },
      'copy-report': function () {
        if (state.audit) copyText(auditReportJson(), 'Report copied as JSON');
      },
      'download-json': function () {
        if (state.audit) download('r-best-practices-report.json', auditReportJson(), 'application/json');
      },
      'download-md': function () {
        if (state.audit) download('r-best-practices-report.md', auditReportMarkdown(), 'text/markdown');
      },
      'download-zip': downloadZip,
      'copy-file': function () {
        if (state.selectedFile) copyText(state.selectedFile.content, 'File copied');
      },
      'download-file': function () {
        var f = state.selectedFile;
        if (f) download(f.path.split('/').pop(), f.content, 'text/plain');
      },
      'reset-practices': resetPracticeFilters,
      'reset-filters': resetAuditFilters,
    };
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-action]') : null;
      if (el && actions[el.getAttribute('data-action')]) actions[el.getAttribute('data-action')]();
    });

    routeFromHash();
    refreshStatus();
    loadPractices();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
