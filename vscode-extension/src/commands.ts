import * as vscode from 'vscode';
import { RPracticesClient } from './client';
import { DiagnosticsManager } from './diagnostics';

export class CommandHandler {
  constructor(private client: RPracticesClient, private diagnosticsManager: DiagnosticsManager) {}

  async validate(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    const progress = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Validating R project...' },
      async () => {
        try {
          for (const folder of workspaceFolders) {
            const findings = await this.client.validateProject(folder.uri.fsPath);
            this.diagnosticsManager.setProjectDiagnostics(folder.uri, findings);
          }

          const totalFindings = Array.from(this.diagnosticsManager['diagnosticMap'].values()).flat().length;
          vscode.window.showInformationMessage(`Validation complete: ${totalFindings} issues found`);
        } catch (error) {
          vscode.window.showErrorMessage(`Validation failed: ${error}`);
        }
      }
    );
  }

  async detectWorkflow(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    try {
      const folder = workspaceFolders[0];
      const detection = await this.client.detectWorkflow(folder.uri.fsPath);

      const message = `
Detected Workflow: ${detection.workflow}
Confidence: ${detection.confidence}%
Indicators: ${detection.indicators.join(', ') || 'None'}
      `.trim();

      vscode.window.showInformationMessage(message);
    } catch (error) {
      vscode.window.showErrorMessage(`Workflow detection failed: ${error}`);
    }
  }

  async generateTemplate(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    const workflows = [
      'r-script',
      'quarto',
      'shiny',
      'package',
      'rmarkdown',
      'renv',
      'targets',
      'plumber',
      'analysis',
    ];

    const workflow = await vscode.window.showQuickPick(workflows, {
      placeHolder: 'Select R workflow type',
    });

    if (!workflow) return;

    const projectName = await vscode.window.showInputBox({
      placeHolder: 'Project name',
      value: 'my-project',
    });

    if (!projectName) return;

    const authorName = await vscode.window.showInputBox({
      placeHolder: 'Author name (optional)',
    });

    const authorEmail = await vscode.window.showInputBox({
      placeHolder: 'Author email (optional)',
    });

    try {
      const template = await this.client.generateTemplate(workflow, {
        projectName,
        authorName,
        authorEmail,
      });

      const folder = workspaceFolders[0];
      const templatePath = vscode.Uri.joinPath(folder.uri, projectName);

      // Create template files
      for (const file of template.files) {
        const filePath = vscode.Uri.joinPath(templatePath, file.path);
        const fileDir = vscode.Uri.joinPath(filePath, '..');

        // Ensure directory exists
        try {
          await vscode.workspace.fs.createDirectory(fileDir);
        } catch (error) {
          // Directory might already exist
        }

        const bytes = Buffer.from(file.content, 'utf8');
        await vscode.workspace.fs.writeFile(filePath, bytes);
      }

      vscode.window.showInformationMessage(`Template generated: ${projectName}`);
      vscode.commands.executeCommand('vscode.openFolder', templatePath);
    } catch (error) {
      vscode.window.showErrorMessage(`Template generation failed: ${error}`);
    }
  }

  async showReport(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    try {
      const folder = workspaceFolders[0];
      const findings = await this.client.validateProject(folder.uri.fsPath);

      const html = this.generateReportHTML(findings, folder.uri.fsPath);
      const panel = vscode.window.createWebviewPanel(
        'r-practices-report',
        'R Practices Report',
        vscode.ViewColumn.Two,
        {}
      );

      panel.webview.html = html;
    } catch (error) {
      vscode.window.showErrorMessage(`Report generation failed: ${error}`);
    }
  }

  async fixIssue(diagnostic: vscode.Diagnostic): Promise<void> {
    if (!diagnostic.relatedInformation || diagnostic.relatedInformation.length === 0) {
      vscode.window.showWarningMessage('No fix available for this issue');
      return;
    }

    const suggestion = diagnostic.relatedInformation[0].message;
    const editor = vscode.window.activeTextEditor;

    if (editor) {
      const range = diagnostic.range;
      await editor.edit((editBuilder) => {
        editBuilder.replace(range, suggestion);
      });
      vscode.window.showInformationMessage('Fix applied');
    }
  }

  private generateReportHTML(findings: any[], projectPath: string): string {
    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const importantCount = findings.filter((f) => f.severity === 'important').length;
    const recommendedCount = findings.filter((f) => f.severity === 'recommended').length;
    const infoCount = findings.filter((f) => f.severity === 'info').length;

    const findingsHTML = findings
      .map(
        (f) => `
      <div class="finding ${f.severity}">
        <span class="severity">${f.severity.toUpperCase()}</span>
        <span class="category">${f.category}</span>
        <p>${f.message}</p>
        ${f.suggestions ? `<p class="suggestion">💡 ${f.suggestions[0]}</p>` : ''}
      </div>
    `
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
    .stat { padding: 15px; border-radius: 4px; text-align: center; }
    .stat.critical { background: #fee2e2; }
    .stat.important { background: #ffedd5; }
    .stat.recommended { background: #fef3c7; }
    .stat.info { background: #dbeafe; }
    .stat .value { font-size: 24px; font-weight: bold; display: block; }
    .findings { margin-top: 20px; }
    .finding { padding: 12px; border-left: 4px solid #ccc; margin-bottom: 12px; }
    .finding.critical { border-color: #dc2626; background: #fef2f2; }
    .finding.important { border-color: #ea580c; background: #fffbf0; }
    .finding.recommended { border-color: #eab308; background: #fffef5; }
    .finding.info { border-color: #2563eb; background: #f0f4ff; }
    .severity { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; margin-right: 8px; }
    .category { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 12px; background: #e5e7eb; }
    .suggestion { color: #4b5563; margin: 8px 0 0 0; font-size: 13px; }
  </style>
</head>
<body>
  <h1>R Best Practices Report</h1>
  <p>Project: <code>${projectPath}</code></p>

  <div class="summary">
    <div class="stat critical">
      <span class="value">${criticalCount}</span>
      Critical
    </div>
    <div class="stat important">
      <span class="value">${importantCount}</span>
      Important
    </div>
    <div class="stat recommended">
      <span class="value">${recommendedCount}</span>
      Recommended
    </div>
    <div class="stat info">
      <span class="value">${infoCount}</span>
      Info
    </div>
  </div>

  <div class="findings">
    ${findingsHTML}
  </div>
</body>
</html>
    `;
  }
}
