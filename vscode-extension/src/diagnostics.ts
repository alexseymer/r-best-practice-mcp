import * as vscode from 'vscode';
import { MCPClient, Finding } from './mcp-client';

export class DiagnosticsProvider implements vscode.DiagnosticProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private client: MCPClient;
  private outputChannel: vscode.OutputChannel;

  constructor(client: MCPClient, outputChannel: vscode.OutputChannel) {
    this.client = client;
    this.outputChannel = outputChannel;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('r-best-practices');
  }

  async provideDiagnostics(document: vscode.TextDocument): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (!workspaceFolder) return;

      const validation = await this.client.validateProject(workspaceFolder.uri.fsPath);
      const diagnostics = this.findingsToDiagnostics(validation.data.findings);

      this.diagnosticCollection.set(document.uri, diagnostics);
    } catch (error) {
      this.outputChannel.appendLine(`Diagnostics error: ${error}`);
    }
  }

  private findingsToDiagnostics(findings: Finding[]): vscode.Diagnostic[] {
    const config = vscode.workspace.getConfiguration('r-best-practices');
    const minSeverity = config.get<string>('severity') || 'recommended';
    const categories = config.get<string[]>('categories') || [];

    const severityOrder = { critical: 0, important: 1, recommended: 2, info: 3 };
    const minSeverityLevel = severityOrder[minSeverity as keyof typeof severityOrder] || 2;

    return findings
      .filter((finding) => {
        const findingSeverityLevel = severityOrder[finding.severity];
        const categoryMatch = categories.length === 0 || categories.includes(finding.category);
        return findingSeverityLevel <= minSeverityLevel && categoryMatch;
      })
      .map((finding) => {
        const range = new vscode.Range(0, 0, 0, 1);
        const severity = this.mapSeverity(finding.severity);
        const message = `${finding.message}${finding.suggestions ? '\n' + finding.suggestions.map((s) => `→ ${s}`).join('\n') : ''}`;

        const diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.code = finding.id;
        diagnostic.source = 'R Best Practices';
        diagnostic.tags = finding.severity === 'critical' ? [vscode.DiagnosticTag.Unnecessary] : [];

        return diagnostic;
      });
  }

  private mapSeverity(severity: string): vscode.DiagnosticSeverity {
    const severityMap: Record<string, vscode.DiagnosticSeverity> = {
      critical: vscode.DiagnosticSeverity.Error,
      important: vscode.DiagnosticSeverity.Warning,
      recommended: vscode.DiagnosticSeverity.Information,
      info: vscode.DiagnosticSeverity.Hint,
    };
    return severityMap[severity] || vscode.DiagnosticSeverity.Information;
  }

  refresh(): void {
    this.diagnosticCollection.clear();
    const editors = vscode.window.visibleTextEditors;
    editors.forEach((editor) => {
      this.provideDiagnostics(editor.document).catch((error) => {
        this.outputChannel.appendLine(`Refresh error: ${error}`);
      });
    });
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
