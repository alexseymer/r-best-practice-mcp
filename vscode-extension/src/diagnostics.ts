import * as vscode from 'vscode';

interface Finding {
  id: string;
  severity: 'critical' | 'important' | 'recommended' | 'info';
  category: string;
  message: string;
  suggestions?: string[];
  file?: string;
  line?: number;
}

export class DiagnosticsManager {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('r-practices');
  }

  setDiagnostics(uri: vscode.Uri, findings: Finding[]): void {
    const diagnostics = this.convertFindingsToDiagnostics(findings, uri);
    this.diagnosticCollection.set(uri, diagnostics);
    this.diagnosticMap.set(uri.fsPath, diagnostics);
  }

  setProjectDiagnostics(uri: vscode.Uri, findings: Finding[]): void {
    const fileGrouped = new Map<string, Finding[]>();

    // Group findings by file
    for (const finding of findings) {
      const filePath = finding.file || uri.fsPath;
      if (!fileGrouped.has(filePath)) {
        fileGrouped.set(filePath, []);
      }
      fileGrouped.get(filePath)!.push(finding);
    }

    // Set diagnostics for each file
    for (const [filePath, fileFindings] of fileGrouped) {
      try {
        const fileUri = vscode.Uri.file(filePath);
        const diagnostics = this.convertFindingsToDiagnostics(fileFindings, fileUri);
        this.diagnosticCollection.set(fileUri, diagnostics);
        this.diagnosticMap.set(filePath, diagnostics);
      } catch (error) {
        console.error(`Failed to set diagnostics for ${filePath}:`, error);
      }
    }
  }

  clear(): void {
    this.diagnosticCollection.clear();
    this.diagnosticMap.clear();
  }

  clearFile(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
    this.diagnosticMap.delete(uri.fsPath);
  }

  getDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
    return this.diagnosticMap.get(uri.fsPath) || [];
  }

  private convertFindingsToDiagnostics(findings: Finding[], uri: vscode.Uri): vscode.Diagnostic[] {
    return findings.map((finding) => {
      const severity = this.getSeverity(finding.severity);
      const line = finding.line ? finding.line - 1 : 0;
      const range = new vscode.Range(line, 0, line, Number.MAX_VALUE);

      const diagnostic = new vscode.Diagnostic(range, finding.message, severity);
      diagnostic.code = finding.id;
      diagnostic.source = 'R Best Practices';
      diagnostic.tags = this.getTags(finding.severity);

      if (finding.suggestions && finding.suggestions.length > 0) {
        const codeAction = new vscode.CodeAction(finding.suggestions[0], vscode.CodeActionKind.QuickFix);
        codeAction.diagnostics = [diagnostic];
        diagnostic.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(uri, range),
            finding.suggestions[0]
          ),
        ];
      }

      return diagnostic;
    });
  }

  private getSeverity(severity: string): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'critical':
        return vscode.DiagnosticSeverity.Error;
      case 'important':
        return vscode.DiagnosticSeverity.Warning;
      case 'recommended':
        return vscode.DiagnosticSeverity.Information;
      case 'info':
        return vscode.DiagnosticSeverity.Hint;
      default:
        return vscode.DiagnosticSeverity.Information;
    }
  }

  private getTags(severity: string): vscode.DiagnosticTag[] {
    if (severity === 'critical') {
      return [vscode.DiagnosticTag.Unnecessary];
    }
    return [];
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
