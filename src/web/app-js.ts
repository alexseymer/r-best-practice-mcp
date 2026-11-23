/**
 * The page's behaviour: practices list, system status and setup instructions. Plain browser JavaScript
 * without libraries. Text is always set with textContent, never as HTML. This file must not contain
 * backticks or dollar-brace sequences, because it lives inside a template literal.
 */
export const APP_JS = String.raw`(function () {
  'use strict';

  var TABS = ['practices', 'system', 'setup'];
  var SEVERITY_ORDER = { critical: 0, important: 1, recommended: 2, info: 3 };
  var DEFAULT_PACKAGE = 'github:alexseymer/r-best-practice-mcp';
  var DEFAULT_BIN = 'r-best-practices-mcp';

  var state = { practices: [], open: {}, system: null, health: null, mode: 'remote' };

  function $(id) { return document.getElementById(id); }

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (key) {
      var value = props[key];
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.slice(0, 2) === 'on') node.addEventListener(key.slice(2), value);
      else if (value === true) node.setAttribute(key, '');
      else if (value !== false && value != null) node.setAttribute(key, value);
    });
    (kids || []).forEach(function (kid) {
      if (kid == null || kid === false) return;
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function getJson(url) {
    return fetch(url, { headers: { Accept: 'application/json' } }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }

  /* ---------- tabs and routing ---------- */

  function parseHash() {
    var parts = location.hash.replace(/^#/, '').split('/');
    var tab = TABS.indexOf(parts[0]) >= 0 ? parts[0] : 'practices';
    return { tab: tab, id: parts[1] ? decodeURIComponent(parts[1]) : '' };
  }

  function showTab(name) {
    TABS.forEach(function (tab) {
      var selected = tab === name;
      var button = $('tab-' + tab);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      button.tabIndex = selected ? 0 : -1;
      $('panel-' + tab).hidden = !selected;
    });
    if (name === 'system') loadSystem();
    if (name === 'setup') loadSystem().then(renderSetup, renderSetup);
  }

  function applyHash() {
    var route = parseHash();
    if (route.tab === 'practices' && route.id) state.open[route.id] = true;
    showTab(route.tab);
    if (route.tab === 'practices') {
      renderPractices();
      if (route.id) {
        var node = document.getElementById('practice-' + route.id);
        if (node) node.scrollIntoView({ block: 'center' });
      }
    }
  }

  TABS.forEach(function (tab) {
    $('tab-' + tab).addEventListener('click', function () {
      history.pushState(null, '', '#' + tab);
      applyHash();
    });
  });

  $('tab-practices').parentNode.addEventListener('keydown', function (event) {
    var index = TABS.indexOf(parseHash().tab);
    var next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    history.pushState(null, '', '#' + TABS[next]);
    applyHash();
    $('tab-' + TABS[next]).focus();
  });

  window.addEventListener('hashchange', applyHash);

  /* ---------- practices ---------- */

  function badge(text, kind) { return el('span', { class: 'badge ' + kind, text: text }); }

  function matches(practice, filters) {
    if (filters.workflow && practice.workflow !== filters.workflow) return false;
    if (filters.severity && practice.severity !== filters.severity) return false;
    if (filters.enforcement && practice.enforcement !== filters.enforcement) return false;
    if (filters.query) {
      var haystack = [practice.id, practice.title, practice.description, (practice.tags || []).join(' ')]
        .join(' ').toLowerCase();
      if (haystack.indexOf(filters.query) < 0) return false;
    }
    return true;
  }

  function currentFilters() {
    return {
      query: $('f-query').value.trim().toLowerCase(),
      workflow: $('f-workflow').value,
      severity: $('f-severity').value,
      enforcement: $('f-enforcement').value
    };
  }

  function section(title, content) {
    return [el('h3', { text: title }), content];
  }

  function practiceBody(practice) {
    var body = el('div', { class: 'item-body', id: 'body-' + practice.id });
    body.appendChild(el('p', { text: practice.description }));
    if (practice.details) section('Why it matters and what is checked', el('p', { text: practice.details })).forEach(function (n) { body.appendChild(n); });
    if (practice.goodExample) section('Good example', el('pre', {}, [el('code', { text: practice.goodExample })])).forEach(function (n) { body.appendChild(n); });
    if (practice.badExample) section('Bad example', el('pre', {}, [el('code', { text: practice.badExample })])).forEach(function (n) { body.appendChild(n); });
    var links = (practice.references || []).filter(function (url) { return url.indexOf('https://') === 0; });
    if (links.length) {
      var list = el('ul');
      links.forEach(function (url) {
        list.appendChild(el('li', {}, [el('a', { href: url, rel: 'noopener', target: '_blank', text: url })]));
      });
      section('References', list).forEach(function (n) { body.appendChild(n); });
    }
    if ((practice.tags || []).length) {
      var tags = el('div', { class: 'item-meta' });
      practice.tags.forEach(function (tag) { tags.appendChild(badge(tag, 'chip')); });
      section('Tags', tags).forEach(function (n) { body.appendChild(n); });
    }
    body.appendChild(el('p', { class: 'permalink' }, [
      el('a', { href: '#practices/' + encodeURIComponent(practice.id), text: 'Link to this practice' })
    ]));
    return body;
  }

  function practiceItem(practice) {
    var open = !!state.open[practice.id];
    var head = el('button', {
      type: 'button', class: 'item-head', 'aria-expanded': open ? 'true' : 'false',
      'aria-controls': 'body-' + practice.id
    }, [
      el('span', { class: 'item-title', text: practice.title }),
      el('span', { class: 'item-meta' }, [
        el('span', { class: 'item-id', text: practice.id }),
        badge(practice.severity, practice.severity),
        badge(practice.enforcement === 'automated' ? 'checked automatically' : 'guidance only', practice.enforcement),
        badge(practice.workflow, 'chip')
      ])
    ]);
    var item = el('li', { class: 'item', id: 'practice-' + practice.id }, [head]);
    if (open) item.appendChild(practiceBody(practice));
    head.addEventListener('click', function () {
      if (state.open[practice.id]) delete state.open[practice.id]; else state.open[practice.id] = true;
      var existing = item.querySelector('.item-body');
      if (existing) { item.removeChild(existing); head.setAttribute('aria-expanded', 'false'); }
      else { item.appendChild(practiceBody(practice)); head.setAttribute('aria-expanded', 'true'); }
    });
    return item;
  }

  function renderPractices() {
    var list = $('practice-list');
    var filters = currentFilters();
    var shown = state.practices.filter(function (p) { return matches(p, filters); });
    shown.sort(function (a, b) {
      if (a.workflow !== b.workflow) return a.workflow < b.workflow ? -1 : 1;
      var bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      return bySeverity || (a.title < b.title ? -1 : 1);
    });
    clear(list);
    shown.forEach(function (practice) { list.appendChild(practiceItem(practice)); });
    $('count').textContent = shown.length === state.practices.length
      ? state.practices.length + ' practices'
      : shown.length + ' of ' + state.practices.length + ' practices';
  }

  function loadPractices() {
    return getJson('/api/practices').then(function (data) {
      state.practices = data.practices;
      var workflows = {};
      state.practices.forEach(function (p) { workflows[p.workflow] = true; });
      var select = $('f-workflow');
      Object.keys(workflows).sort().forEach(function (name) {
        select.appendChild(el('option', { value: name, text: name }));
      });
      applyHash();
    }).catch(function (error) {
      $('count').textContent = 'The practices could not be loaded (' + error.message + ').';
    });
  }

  ['f-query', 'f-workflow', 'f-severity', 'f-enforcement'].forEach(function (id) {
    $(id).addEventListener(id === 'f-query' ? 'input' : 'change', renderPractices);
  });
  $('filters').addEventListener('submit', function (event) { event.preventDefault(); });

  /* ---------- system ---------- */

  function formatUptime(seconds) {
    var days = Math.floor(seconds / 86400);
    var hours = Math.floor((seconds % 86400) / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    if (days) return days + ' d ' + hours + ' h';
    if (hours) return hours + ' h ' + minutes + ' min';
    return minutes + ' min ' + (seconds % 60) + ' s';
  }

  function loadSystem() {
    return Promise.all([
      getJson('/api/system'),
      fetch('/health').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (results) {
      state.system = results[0];
      state.health = results[1];
      renderSystem();
      return state.system;
    }).catch(function (error) {
      state.system = null;
      clear($('system'));
      $('system').appendChild(el('p', { class: 'notice', text: 'The system status could not be loaded (' + error.message + ').' }));
      $('system-updated').textContent = '';
      throw error;
    });
  }

  function card(title, big, small, extra) {
    return el('div', { class: 'card' + (extra && extra.wide ? ' wide' : '') }, [
      el('h3', { text: title }),
      big ? el('div', { class: 'big' }, [big]) : null,
      small ? el('p', { class: 'small', text: small }) : null,
      extra && extra.node ? extra.node : null
    ]);
  }

  function renderSystem() {
    var s = state.system;
    var up = !!(state.health && state.health.status === 'ok');
    var root = $('system');
    clear(root);

    var build = s.build && s.build.commit ? s.build.commit.slice(0, 7) : 'not recorded';
    var built = s.build && s.build.builtAt ? 'built ' + s.build.builtAt : 'build time not recorded';

    var tools = el('ul', { class: 'tool-list' });
    s.tools.forEach(function (tool) {
      var summary = tool.description.replace(/\x60/g, '').split('. ')[0];
      if (summary.slice(-1) !== '.') summary += '.';
      tools.appendChild(el('li', {}, [el('code', { text: tool.name }), el('span', { class: 'muted', text: summary })]));
    });

    var limits = s.limits;
    var cards = el('div', { class: 'cards' }, [
      card('Status', badge(up ? 'running' : 'not reachable', up ? 'ok' : 'bad'), up ? 'The health check answers.' : 'The health check did not answer.'),
      card('Version', s.version, 'Mode: ' + s.mode),
      card('Build', build, built),
      card('Uptime', formatUptime(s.uptimeSeconds), 'Since the last start'),
      card('Practices', String(s.practices.total), s.practices.automated + ' checked automatically, ' + s.practices.guidance + ' guidance only'),
      card('Project types', String(s.practices.workflows.length), s.practices.workflows.map(function (w) { return w.id; }).join(', ')),
      card('Limits', limits.rateLimitPerMinute ? limits.rateLimitPerMinute + ' / min' : 'No request limit',
        'Requests per client. check_files: ' + limits.maxFiles + ' files, ' + Math.round(limits.maxFileBytes / 1000) + ' kB per file, ' + Math.round(limits.maxTotalBytes / 1000) + ' kB in total'),
      card('Tools', null, null, { wide: true, node: tools }),
      card('Endpoints', null, null, { wide: true, node: el('div', {}, [
        codebox(location.origin + s.endpoints.mcp, 'MCP endpoint'),
        codebox(location.origin + s.endpoints.health, 'Health check')
      ]) })
    ]);
    root.appendChild(cards);
    $('system-updated').textContent = 'Checked ' + new Date().toLocaleTimeString();
  }

  $('system-refresh').addEventListener('click', function () { loadSystem().catch(function () {}); });

  /* ---------- copy and code boxes ---------- */

  function copyText(text, button) {
    var original = button.textContent;
    function finish(ok) {
      button.textContent = ok ? 'Copied' : 'Select and copy';
      setTimeout(function () { button.textContent = original; }, 1800);
    }
    function fallback() {
      var area = el('textarea', { 'aria-hidden': 'true', readonly: true });
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(area);
      finish(ok);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { finish(true); }, fallback);
    } else {
      fallback();
    }
  }

  function codebox(text, label) {
    var button = el('button', { type: 'button', class: 'btn copy', 'aria-live': 'polite', text: 'Copy' });
    button.addEventListener('click', function () { copyText(text, button); });
    button.setAttribute('aria-label', 'Copy ' + (label || 'code'));
    return el('div', { class: 'codebox' }, [el('pre', {}, [el('code', { text: text })]), button]);
  }

  /* ---------- setup ---------- */

  function setupInfo() {
    var install = state.system && state.system.localInstall;
    return {
      url: location.origin + '/mcp',
      pkg: install ? install.package : DEFAULT_PACKAGE,
      bin: install ? install.bin : DEFAULT_BIN,
      https: location.protocol === 'https:'
    };
  }

  function json(value) { return JSON.stringify(value, null, 2); }

  function localArgs(info) { return ['exec', '--yes', '--package=' + info.pkg, '--', info.bin]; }

  function localCommand(info) { return 'npm exec --yes --package=' + info.pkg + ' -- ' + info.bin; }

  function docsLink(url, text) {
    return el('p', {}, [el('a', { href: url, rel: 'noopener', target: '_blank', text: text })]);
  }

  function step(title, text) {
    return [el('h3', { text: title }), text ? el('p', { text: text }) : null];
  }

  function clientCard(name, kids) {
    return el('details', { class: 'client' }, [el('summary', { text: name }), el('div', { class: 'client-body' }, kids)]);
  }

  function claudeCode(info, remote) {
    var kids = [];
    if (remote) {
      kids.push.apply(kids, step('Add the server', 'Run this once. With --scope user the server is available in every project.'));
      kids.push(codebox('claude mcp add --scope user --transport http r-practices ' + info.url, 'command'));
      kids.push.apply(kids, step('Or share it with a project', 'Put this in .mcp.json at the project root. Claude Code asks you to approve it the first time.'));
      kids.push(codebox(json({ mcpServers: { 'r-practices': { type: 'http', url: info.url } } }), '.mcp.json'));
    } else {
      kids.push.apply(kids, step('Add the server', 'Run this once. With --scope user the server is available in every project.'));
      kids.push(codebox('claude mcp add --scope user r-practices -- ' + localCommand(info), 'command'));
      kids.push.apply(kids, step('Or share it with a project', 'Put this in .mcp.json at the project root. Claude Code asks you to approve it the first time.'));
      kids.push(codebox(json({ mcpServers: { 'r-practices': { command: 'npm', args: localArgs(info) } } }), '.mcp.json'));
    }
    kids.push.apply(kids, step('Use it', 'Type / in Claude Code to find the guided prompts, for example /mcp__r-practices__neues-r-paket. Ask Claude to check a project or to explain a practice.'));
    kids.push(docsLink('https://code.claude.com/docs/en/mcp', 'Claude Code: MCP documentation'));
    return clientCard('Claude Code', kids);
  }

  function claudeDesktop(info, remote) {
    var kids = [];
    if (remote) {
      kids.push.apply(kids, step('Add a custom connector', 'Open Settings, then Connectors. Choose Add, then Add custom connector, and paste this URL.'));
      kids.push(codebox(info.url, 'MCP URL'));
      if (!info.https) kids.push(el('p', { class: 'warn', text: 'This page is not served over HTTPS. Claude Desktop connectors need the server’s HTTPS URL.' }));
      kids.push(el('p', { class: 'muted', text: 'Which plans can add custom connectors is set by Anthropic; see their documentation. If your plan cannot, use the local setup instead.' }));
      kids.push(docsLink('https://modelcontextprotocol.io/docs/develop/connect-remote-servers', 'Connect to remote MCP servers'));
    } else {
      kids.push.apply(kids, step('Edit the config file', 'In Claude Desktop open Settings, Developer, Edit Config. The file is claude_desktop_config.json:'));
      kids.push(el('p', { class: 'muted', text: 'macOS: ~/Library/Application Support/Claude/claude_desktop_config.json' }));
      kids.push(el('p', { class: 'muted', text: 'Windows: %APPDATA%\\Claude\\claude_desktop_config.json' }));
      kids.push(el('p', { class: 'muted', text: 'Linux: ~/.config/Claude/claude_desktop_config.json' }));
      kids.push(codebox(json({ mcpServers: { 'r-practices': { command: 'npm', args: localArgs(info) } } }), 'claude_desktop_config.json'));
      kids.push(el('p', { text: 'Save the file, then quit Claude Desktop completely and start it again.' }));
      kids.push(docsLink('https://modelcontextprotocol.io/docs/develop/connect-local-servers', 'Connect to local MCP servers'));
    }
    return clientCard('Claude Desktop', kids);
  }

  function cursor(info, remote) {
    var config = remote
      ? { mcpServers: { 'r-practices': { url: info.url } } }
      : { mcpServers: { 'r-practices': { command: 'npm', args: localArgs(info) } } };
    return clientCard('Cursor', [].concat(
      step('Add it to mcp.json', 'Use .cursor/mcp.json in a project, or ~/.cursor/mcp.json for all projects.'),
      [codebox(json(config), 'mcp.json')],
      step('Use it', 'Ask the agent to check a project or to explain a practice. Cursor lists the tools under the MCP settings.'),
      [docsLink('https://cursor.com/docs/context/mcp', 'Cursor: MCP documentation')]
    ));
  }

  function vscode(info, remote) {
    var entry = remote
      ? { type: 'http', url: info.url }
      : { type: 'stdio', command: 'npm', args: localArgs(info) };
    return clientCard('VS Code (GitHub Copilot)', [].concat(
      step('Add it to .mcp.json', 'Put this in .mcp.json at the workspace root.'),
      [codebox(json({ mcpServers: { 'r-practices': entry } }), '.mcp.json')],
      [el('p', { class: 'muted', text: 'Older VS Code setups read .vscode/mcp.json instead, with the key "servers" in place of "mcpServers".' })],
      [docsLink('https://code.visualstudio.com/docs/copilot/customization/mcp-servers', 'VS Code: MCP servers')]
    ));
  }

  function renderSetup() {
    var info = setupInfo();
    var remote = state.mode === 'remote';
    $('mode-remote').setAttribute('aria-pressed', remote ? 'true' : 'false');
    $('mode-local').setAttribute('aria-pressed', remote ? 'false' : 'true');
    $('mode-hint').textContent = remote
      ? 'Connect your client to this hosted server with its URL. Nothing to install. The hosted server cannot see your files; your assistant sends the files to check (tool check_files).'
      : 'Run the server on your computer. It reads your project folders directly (tool check_project). Needs Node.js 20 or newer.';
    var root = $('setup');
    clear(root);
    [claudeCode, claudeDesktop, cursor, vscode].forEach(function (build, index) {
      var node = build(info, remote);
      if (index === 0) node.open = true;
      root.appendChild(node);
    });
  }

  $('mode-remote').addEventListener('click', function () { state.mode = 'remote'; renderSetup(); });
  $('mode-local').addEventListener('click', function () { state.mode = 'local'; renderSetup(); });

  /* ---------- start ---------- */

  loadPractices();
})();
`;
