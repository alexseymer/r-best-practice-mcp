import * as vscode from 'vscode';

export interface ReportData {
  workflow: string;
  findings: Array<{
    id: string;
    severity: 'critical' | 'important' | 'recommended' | 'info';
    category: string;
    message: string;
    suggestions?: string[];
    file?: string;
    line?: number;
  }>;
  projectPath: string;
  duration: number;
}

export class ReportWebView {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private context: vscode.ExtensionContext) {}

  show(data: ReportData): void {
    const columnToShowIn = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

    if (this.panel) {
      this.panel.reveal(columnToShowIn);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'r-best-practices.report',
        'R Best Practices Report',
        columnToShowIn,
        { enableScripts: true }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      }, undefined, this.context.subscriptions);
    }

    this.panel.webview.html = this.getHtmlContent(data);
  }

  private getHtmlContent(data: ReportData): string {
    const criticalCount = data.findings.filter((f) => f.severity === 'critical').length;
    const importantCount = data.findings.filter((f) => f.severity === 'important').length;
    const recommendedCount = data.findings.filter((f) => f.severity === 'recommended').length;
    const infoCount = data.findings.filter((f) => f.severity === 'info').length;

    const findingsHTML = data.findings
      .map(
        (f) => `
      <div class="finding finding-${f.severity}">
        <div class="finding-header">
          <span class="severity severity-${f.severity}">${f.severity.toUpperCase()}</span>
          <span class="category">${f.category}</span>
          ${f.file ? `<span class="file">${f.file}${f.line ? `:${f.line}` : ''}</span>` : ''}
        </div>
        <p class="message">${this.escapeHtml(f.message)}</p>
        ${
          f.suggestions && f.suggestions.length > 0
            ? `
          <div class="suggestions">
            <strong>Suggestions:</strong>
            <ul>
              ${f.suggestions.map((s) => `<li>${this.escapeHtml(s)}</li>`).join('')}
            </ul>
          </div>
        `
            : ''
        }
      </div>
    `
      )
      .join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>R Best Practices Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
    }

    header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    h1 {
      font-size: 28px;
      margin-bottom: 10px;
      color: #1f2937;
    }

    .metadata {
      font-size: 14px;
      color: #6b7280;
      margin-top: 10px;
    }

    .metadata-item {
      margin: 5px 0;
    }

    .code {
      font-family: 'Courier New', Courier, monospace;
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 3px;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }

    .stat {
      background: white;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .stat-critical {
      border-left-color: #dc2626;
      background: linear-gradient(135deg, rgba(220, 38, 38, 0.05), rgba(220, 38, 38, 0.02));
    }

    .stat-important {
      border-left-color: #ea580c;
      background: linear-gradient(135deg, rgba(234, 88, 12, 0.05), rgba(234, 88, 12, 0.02));
    }

    .stat-recommended {
      border-left-color: #eab308;
      background: linear-gradient(135deg, rgba(234, 179, 8, 0.05), rgba(234, 179, 8, 0.02));
    }

    .stat-info {
      border-left-color: #2563eb;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(37, 99, 235, 0.02));
    }

    .stat-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: #1f2937;
    }

    .findings-section {
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .findings-section h2 {
      font-size: 20px;
      margin-bottom: 20px;
      color: #1f2937;
    }

    .finding {
      padding: 16px;
      border-left: 4px solid;
      margin-bottom: 15px;
      border-radius: 4px;
      background: white;
    }

    .finding-critical {
      border-left-color: #dc2626;
      background: #fef2f2;
    }

    .finding-important {
      border-left-color: #ea580c;
      background: #fffbf0;
    }

    .finding-recommended {
      border-left-color: #eab308;
      background: #fffef5;
    }

    .finding-info {
      border-left-color: #2563eb;
      background: #f0f4ff;
    }

    .finding-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }

    .severity {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .severity-critical {
      background: #dc2626;
      color: white;
    }

    .severity-important {
      background: #ea580c;
      color: white;
    }

    .severity-recommended {
      background: #eab308;
      color: white;
    }

    .severity-info {
      background: #2563eb;
      color: white;
    }

    .category {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      background: #e5e7eb;
      color: #374151;
      text-transform: capitalize;
    }

    .file {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      background: #f3f4f6;
      color: #6b7280;
      font-family: 'Courier New', Courier, monospace;
    }

    .message {
      margin: 10px 0;
      color: #374151;
      font-size: 14px;
      line-height: 1.5;
    }

    .suggestions {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }

    .suggestions strong {
      display: block;
      color: #1f2937;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .suggestions ul {
      margin-left: 20px;
      list-style: disc;
    }

    .suggestions li {
      margin-bottom: 6px;
      color: #4b5563;
      font-size: 13px;
    }

    .no-findings {
      text-align: center;
      padding: 40px 20px;
      color: #6b7280;
    }

    .no-findings-icon {
      font-size: 48px;
      margin-bottom: 15px;
    }

    .no-findings h3 {
      font-size: 18px;
      color: #1f2937;
      margin-bottom: 5px;
    }

    @media (prefers-color-scheme: dark) {
      body {
        background: #1e1e1e;
        color: #e0e0e0;
      }

      header, .findings-section {
        background: #252526;
        color: #e0e0e0;
      }

      h1 {
        color: #e0e0e0;
      }

      .stat {
        background: #2d2d30;
        color: #e0e0e0;
      }

      .finding {
        background: #2d2d30;
        color: #e0e0e0;
      }

      .message {
        color: #d4d4d4;
      }

      .metadata {
        color: #858585;
      }

      .stat-label {
        color: #858585;
      }

      .code {
        background: #3e3e42;
      }

      .file {
        background: #3e3e42;
        color: #858585;
      }

      .suggestions li {
        color: #b4b4b4;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>R Best Practices Report</h1>
      <div class="metadata">
        <div class="metadata-item">
          <strong>Project:</strong> <span class="code">${this.escapeHtml(data.projectPath)}</span>
        </div>
        <div class="metadata-item">
          <strong>Workflow:</strong> ${this.escapeHtml(data.workflow)}
        </div>
        <div class="metadata-item">
          <strong>Analysis Time:</strong> ${data.duration}ms
        </div>
      </div>
    </header>

    <div class="summary">
      <div class="stat stat-critical">
        <div class="stat-label">Critical</div>
        <div class="stat-value">${criticalCount}</div>
      </div>
      <div class="stat stat-important">
        <div class="stat-label">Important</div>
        <div class="stat-value">${importantCount}</div>
      </div>
      <div class="stat stat-recommended">
        <div class="stat-label">Recommended</div>
        <div class="stat-value">${recommendedCount}</div>
      </div>
      <div class="stat stat-info">
        <div class="stat-label">Info</div>
        <div class="stat-value">${infoCount}</div>
      </div>
    </div>

    <div class="findings-section">
      <h2>Findings (${data.findings.length})</h2>
      ${
        data.findings.length === 0
          ? `
        <div class="no-findings">
          <div class="no-findings-icon">✨</div>
          <h3>No Issues Found</h3>
          <p>Your project follows R best practices!</p>
        </div>
      `
          : `<div class="findings">${findingsHTML}</div>`
      }
    </div>
  </div>
</body>
</html>
    `;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
