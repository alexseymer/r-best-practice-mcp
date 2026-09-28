import * as vscode from 'vscode';
import { MCPClient } from './mcp-client';
import { DiagnosticsProvider } from './diagnostics';
import { ReportWebView, ReportData } from './webview';

export class CommandHandler {
  private reportWebView: ReportWebView;

  constructor(
    private client: MCPClient,
    private diagnosticsManager: DiagnosticsProvider,
    private outputChannel: vscode.OutputChannel
  ) {
    // ReportWebView will be initialized with context when needed
  }

  setReportWebView(webview: ReportWebView): void {
    this.reportWebView = webview;
  }

  async validateProject(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Validating R project...' },
      async () => {
        try {
          const folder = workspaceFolders[0];
          const validation = await this.client.validateProject(folder.uri.fsPath);
          const findings = validation.data.findings;

          const totalFindings = findings.length;
          const criticalCount = findings.filter((f) => f.severity === 'critical').length;

          if (criticalCount > 0) {
            vscode.window.showErrorMessage(`Validation complete: ${totalFindings} issues found (${criticalCount} critical)`);
          } else if (totalFindings > 0) {
            vscode.window.showWarningMessage(`Validation complete: ${totalFindings} issues found`);
          } else {
            vscode.window.showInformationMessage('Validation complete: No issues found');
          }

          this.diagnosticsManager.refresh();
        } catch (error) {
          vscode.window.showErrorMessage(`Validation failed: ${error}`);
          this.outputChannel.appendLine(`Validation error: ${error}`);
        }
      }
    );
  }

  async validateFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }

    try {
      const filePath = editor.document.uri.fsPath;
      const result = await this.client.validateFile(filePath);
      const findings = result.data.findings;

      if (findings.length === 0) {
        vscode.window.showInformationMessage('No issues found in this file');
      } else {
        vscode.window.showInformationMessage(`Found ${findings.length} issue(s) in this file`);
      }

      this.outputChannel.appendLine(`File validation: ${findings.length} issues in ${filePath}`);
    } catch (error) {
      vscode.window.showErrorMessage(`File validation failed: ${error}`);
      this.outputChannel.appendLine(`File validation error: ${error}`);
    }
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

      const message = `Detected: ${detection.workflow} (${detection.confidence}% confidence)`;
      vscode.window.showInformationMessage(message);

      this.outputChannel.appendLine(`Workflow detected: ${detection.workflow} at ${detection.confidence}%`);
    } catch (error) {
      vscode.window.showErrorMessage(`Workflow detection failed: ${error}`);
      this.outputChannel.appendLine(`Detection error: ${error}`);
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
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Generating ${workflow} template...` },
        async () => {
          const template = await this.client.generateTemplate(workflow, projectName);
          const folder = workspaceFolders[0];
          const templatePath = vscode.Uri.joinPath(folder.uri, projectName);

          // Create template files
          for (const file of template.data.files) {
            const filePath = vscode.Uri.joinPath(templatePath, file.path);
            const fileDir = vscode.Uri.joinPath(filePath, '..');

            try {
              await vscode.workspace.fs.createDirectory(fileDir);
            } catch {
              // Directory might already exist
            }

            const bytes = Buffer.from(file.content, 'utf8');
            await vscode.workspace.fs.writeFile(filePath, bytes);
          }

          vscode.window.showInformationMessage(`Template generated: ${projectName}`);
          const openFolder = await vscode.window.showInformationMessage(
            `Open ${projectName} in new window?`,
            'Yes',
            'No'
          );

          if (openFolder === 'Yes') {
            vscode.commands.executeCommand('vscode.openFolder', templatePath, true);
          }

          this.outputChannel.appendLine(`Template generated: ${workflow} at ${templatePath}`);
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Template generation failed: ${error}`);
      this.outputChannel.appendLine(`Template generation error: ${error}`);
    }
  }

  async showReport(context: vscode.ExtensionContext): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Generating report...' },
        async () => {
          const folder = workspaceFolders[0];
          const validation = await this.client.validateProject(folder.uri.fsPath);

          const reportData: ReportData = {
            workflow: validation.data.workflow,
            findings: validation.data.findings,
            projectPath: folder.uri.fsPath,
            duration: validation.data.duration,
          };

          if (!this.reportWebView) {
            this.reportWebView = new ReportWebView(context);
          }

          this.reportWebView.show(reportData);
          this.outputChannel.appendLine(`Report generated for ${folder.uri.fsPath}`);
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Report generation failed: ${error}`);
      this.outputChannel.appendLine(`Report generation error: ${error}`);
    }
  }

  async toggleAutoValidation(): Promise<void> {
    const config = vscode.workspace.getConfiguration('r-best-practices');
    const autoValidate = config.get<boolean>('autoValidate', true);

    try {
      await config.update('autoValidate', !autoValidate, vscode.ConfigurationTarget.Global);
      const newState = !autoValidate ? 'enabled' : 'disabled';
      vscode.window.showInformationMessage(`Auto-validation ${newState}`);
      this.outputChannel.appendLine(`Auto-validation toggled: ${newState}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update setting: ${error}`);
    }
  }
}
