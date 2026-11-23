/** Styles of the page. Light and dark follow the system setting; no fonts or other files are loaded. */
export const APP_CSS = String.raw`:root {
  --bg: #fafaf9;
  --surface: #ffffff;
  --text: #1c1917;
  --muted: #57534e;
  --border: #e7e5e4;
  --accent: #0f766e;
  --accent-text: #ffffff;
  --code-bg: #f5f5f4;
  --focus: #0f766e;
  --sev-critical-bg: #fee2e2;    --sev-critical-fg: #991b1b;
  --sev-important-bg: #fef3c7;   --sev-important-fg: #92400e;
  --sev-recommended-bg: #dbeafe; --sev-recommended-fg: #1e40af;
  --sev-info-bg: #e7e5e4;        --sev-info-fg: #44403c;
  --auto-bg: #dcfce7;            --auto-fg: #166534;
  --guide-bg: #f3e8ff;           --guide-fg: #6b21a8;
  --ok-bg: #dcfce7;              --ok-fg: #166534;
  --bad-bg: #fee2e2;             --bad-fg: #991b1b;
  --radius: 10px;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0c0a09;
    --surface: #1c1917;
    --text: #fafaf9;
    --muted: #a8a29e;
    --border: #292524;
    --accent: #2dd4bf;
    --accent-text: #042f2e;
    --code-bg: #141211;
    --focus: #2dd4bf;
    --sev-critical-bg: #450a0a;    --sev-critical-fg: #fecaca;
    --sev-important-bg: #451a03;   --sev-important-fg: #fde68a;
    --sev-recommended-bg: #172554; --sev-recommended-fg: #bfdbfe;
    --sev-info-bg: #292524;        --sev-info-fg: #d6d3d1;
    --auto-bg: #052e16;            --auto-fg: #bbf7d0;
    --guide-bg: #3b0764;           --guide-fg: #e9d5ff;
    --ok-bg: #052e16;              --ok-fg: #bbf7d0;
    --bad-bg: #450a0a;             --bad-fg: #fecaca;
  }
}

* { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.55 var(--font);
}

.wrap { max-width: 960px; margin: 0 auto; padding: 0 16px; }

.sr-only {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

.skip {
  position: absolute; left: 8px; top: -48px; z-index: 10;
  background: var(--accent); color: var(--accent-text);
  padding: 8px 12px; border-radius: 6px; text-decoration: none;
}
.skip:focus { top: 8px; }

a { color: var(--accent); }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: 4px; }

.top { background: var(--surface); border-bottom: 1px solid var(--border); padding-top: 28px; }
h1 { margin: 0 0 8px; font-size: 1.75rem; line-height: 1.2; letter-spacing: -0.01em; }
h1 .mcp { color: var(--accent); }
.lead { margin: 0 0 20px; max-width: 65ch; color: var(--muted); }

.tabs { display: flex; gap: 4px; overflow-x: auto; }
.tab {
  appearance: none; background: none; border: 0; border-bottom: 3px solid transparent;
  padding: 10px 14px; font: inherit; font-weight: 600; color: var(--muted); cursor: pointer;
  white-space: nowrap;
}
.tab:hover { color: var(--text); }
.tab[aria-selected="true"] { color: var(--text); border-bottom-color: var(--accent); }

main.wrap { padding-top: 24px; padding-bottom: 48px; min-height: 60vh; }
.panel[hidden] { display: none; }
.panel:focus-visible { outline-offset: 8px; }

.notice { padding: 12px 16px; background: var(--code-bg); border-radius: var(--radius); }
.muted { color: var(--muted); margin: 0; }
#mode-hint { margin-bottom: 14px; }

.filters { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 0.875rem; color: var(--muted); }
.field.grow { flex: 1 1 220px; }
input[type="search"], select {
  font: inherit; color: var(--text); background: var(--surface);
  border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; min-height: 42px;
}
input[type="search"] { width: 100%; }

.count { margin: 0 0 12px; color: var(--muted); font-size: 0.875rem; }

.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.item { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.item-head {
  display: block; width: 100%; text-align: left; font: inherit; color: inherit;
  background: none; border: 0; padding: 14px 16px; cursor: pointer; border-radius: var(--radius);
}
.item-head:hover { background: var(--code-bg); }
.item-title { display: block; font-weight: 600; }
.item-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 6px; }
.item-id { font-family: var(--mono); font-size: 0.8125rem; color: var(--muted); }
.item-body { padding: 14px 16px 16px; border-top: 1px solid var(--border); }
.item-body h3 { margin: 16px 0 6px; font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.item-body p { margin: 0 0 8px; max-width: 75ch; }
.item-body ul { margin: 0; padding-left: 20px; }
.item-body li { margin: 2px 0; overflow-wrap: anywhere; }
.permalink { margin-top: 12px; font-size: 0.875rem; }

.badge {
  display: inline-block; padding: 1px 8px; border-radius: 999px;
  font-size: 0.75rem; font-weight: 600; line-height: 1.6; white-space: nowrap;
}
.badge.critical { background: var(--sev-critical-bg); color: var(--sev-critical-fg); }
.badge.important { background: var(--sev-important-bg); color: var(--sev-important-fg); }
.badge.recommended { background: var(--sev-recommended-bg); color: var(--sev-recommended-fg); }
.badge.info { background: var(--sev-info-bg); color: var(--sev-info-fg); }
.badge.automated { background: var(--auto-bg); color: var(--auto-fg); }
.badge.guidance { background: var(--guide-bg); color: var(--guide-fg); }
.badge.chip { background: var(--code-bg); color: var(--muted); border: 1px solid var(--border); font-weight: 500; }
.badge.ok { background: var(--ok-bg); color: var(--ok-fg); }
.badge.bad { background: var(--bad-bg); color: var(--bad-fg); }

pre, code { font-family: var(--mono); font-size: 0.8125rem; }
pre {
  margin: 0; padding: 12px 14px; background: var(--code-bg); border: 1px solid var(--border);
  border-radius: 8px; overflow-x: auto; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 2;
}
.codebox { position: relative; margin: 8px 0 16px; }
.codebox .copy { position: absolute; top: 8px; right: 8px; }
.codebox pre { padding-right: 84px; }

.btn {
  font: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer;
  background: var(--surface); color: var(--text); border: 1px solid var(--border);
  border-radius: 8px; padding: 6px 12px; min-height: 36px;
}
.btn:hover { border-color: var(--accent); }

.bar { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.segmented { display: inline-flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--surface); }
.seg {
  font: inherit; font-weight: 600; background: none; border: 0; padding: 9px 16px; cursor: pointer; color: var(--muted);
}
.seg[aria-pressed="true"] { background: var(--accent); color: var(--accent-text); }

.cards { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.card h3 { margin: 0 0 6px; font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.card .big { font-size: 1.5rem; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
.card .big.text { font-size: 1.125rem; }
.card .small { margin: 4px 0 0; color: var(--muted); font-size: 0.875rem; overflow-wrap: anywhere; }
.wide { grid-column: 1 / -1; }
.tool-list { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.tool-list li { display: grid; gap: 2px; }
.tool-list code { font-weight: 600; }

.client { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 12px; }
.client > summary { cursor: pointer; padding: 14px 16px; font-weight: 600; font-size: 1.0625rem; list-style: none; }
.client > summary::-webkit-details-marker { display: none; }
.client > summary::after { content: "+"; float: right; color: var(--muted); font-weight: 400; }
.client[open] > summary::after { content: "\2212"; }
.client-body { padding: 0 16px 8px; }
.client-body h3 { margin: 12px 0 0; font-size: 0.9375rem; }
.client-body p { margin: 6px 0; max-width: 75ch; }
.warn { padding: 8px 12px; border-radius: 8px; background: var(--sev-important-bg); color: var(--sev-important-fg); }

.foot { border-top: 1px solid var(--border); padding: 20px 0 32px; color: var(--muted); font-size: 0.875rem; }
.foot p { margin: 0; }

@media (max-width: 520px) {
  h1 { font-size: 1.5rem; }
  .codebox pre { padding-right: 14px; padding-bottom: 48px; }
  .codebox .copy { top: auto; bottom: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  * { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
}
`;
