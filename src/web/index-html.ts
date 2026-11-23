/** The page shell. Scripts and styles are separate files, so the Content-Security-Policy can stay at 'self'. */
export const INDEX_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>R Best Practices MCP</title>
<meta name="description" content="A free MCP server for R projects: check a project against best practices, explain each practice, and create a standard project step by step.">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/app.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="top">
  <div class="wrap">
    <h1>R Best Practices <span class="mcp">MCP</span></h1>
    <p class="lead">A free MCP server for R projects. Your assistant checks a project against best practices, explains each practice, and creates a standard project with you, step by step.</p>
    <div class="tabs" role="tablist" aria-label="Sections">
      <button class="tab" role="tab" id="tab-practices" aria-controls="panel-practices" aria-selected="true" data-tab="practices">Practices</button>
      <button class="tab" role="tab" id="tab-system" aria-controls="panel-system" aria-selected="false" tabindex="-1" data-tab="system">System</button>
      <button class="tab" role="tab" id="tab-setup" aria-controls="panel-setup" aria-selected="false" tabindex="-1" data-tab="setup">Setup</button>
    </div>
  </div>
</header>

<main id="main" class="wrap">
  <noscript><p class="notice">This page needs JavaScript to show the practices, the system status and the setup instructions. The MCP server itself does not need it.</p></noscript>

  <section class="panel" id="panel-practices" role="tabpanel" aria-labelledby="tab-practices" tabindex="0">
    <h2 class="sr-only">Practices</h2>
    <form class="filters" id="filters" role="search" aria-label="Filter practices">
      <label class="field grow">
        <span>Search</span>
        <input type="search" id="f-query" placeholder="Title, id, description or tag" autocomplete="off">
      </label>
      <label class="field">
        <span>Project type</span>
        <select id="f-workflow"><option value="">All</option></select>
      </label>
      <label class="field">
        <span>Severity</span>
        <select id="f-severity">
          <option value="">All</option>
          <option value="critical">Critical</option>
          <option value="important">Important</option>
          <option value="recommended">Recommended</option>
          <option value="info">Info</option>
        </select>
      </label>
      <label class="field">
        <span>Checked</span>
        <select id="f-enforcement">
          <option value="">All</option>
          <option value="automated">Automatically</option>
          <option value="guidance">Guidance only</option>
        </select>
      </label>
    </form>
    <p class="count" id="count" role="status" aria-live="polite"></p>
    <ul class="list" id="practice-list"></ul>
  </section>

  <section class="panel" id="panel-system" role="tabpanel" aria-labelledby="tab-system" tabindex="0" hidden>
    <h2 class="sr-only">System</h2>
    <div class="bar">
      <p class="muted" id="system-updated"></p>
      <button type="button" class="btn" id="system-refresh">Refresh</button>
    </div>
    <div id="system"></div>
  </section>

  <section class="panel" id="panel-setup" role="tabpanel" aria-labelledby="tab-setup" tabindex="0" hidden>
    <h2 class="sr-only">Setup</h2>
    <div class="bar">
      <div class="segmented" role="group" aria-label="How to connect">
        <button type="button" class="seg" id="mode-remote" aria-pressed="true">Hosted (URL)</button>
        <button type="button" class="seg" id="mode-local" aria-pressed="false">On my computer</button>
      </div>
    </div>
    <p class="muted" id="mode-hint"></p>
    <div id="setup"></div>
  </section>
</main>

<footer class="foot">
  <div class="wrap">
    <p>Free and open source, MIT licensed. <a href="https://github.com/alexseymer/r-best-practice-mcp" rel="noopener">Source code</a>.</p>
  </div>
</footer>

<script src="/app.js" defer></script>
</body>
</html>
`;
