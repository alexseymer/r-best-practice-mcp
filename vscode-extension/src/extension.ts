import * as vscode from 'vscode';
import { MCPClient } from './mcp-client';
import { DiagnosticsProvider } from './diagnostics';
import { CommandHandler } from './commands';
import { ReportWebView } from './webview';

let client: MCPClient;
let diagnosticsProvider: DiagnosticsProvider;
let commandHandler: CommandHandler;
let reportWebView: ReportWebView;

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('R Best Practices');
  outputChannel.appendLine('R Best Practices extension activating...');

  try {
    // Initialize MCP client
    const config = vscode.workspace.getConfiguration('r-best-practices');
    const serverPath = config.get<string>('serverPath') || 'localhost:3000';

    client = new MCPClient(serverPath, outputChannel);
    await client.initialize();

    // Initialize diagnostics provider
    diagnosticsProvider = new DiagnosticsProvider(client, outputChannel);
    context.subscriptions.push(
      vscode.languages.registerDiagnosticProvider(
        [{ language: 'r' }, { scheme: 'file', pattern: '**/*.R' }, { scheme: 'file', pattern: '**/*.Rmd' }],
        diagnosticsProvider,
      ),
    );

    // Initialize command handler
    commandHandler = new CommandHandler(client, diagnosticsProvider, outputChannel);

    // Initialize report WebView
    reportWebView = new ReportWebView(context);
    commandHandler.setReportWebView(reportWebView);

    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand('r-best-practices.detect', () => commandHandler.detectWorkflow()),
      vscode.commands.registerCommand('r-best-practices.validate', () => commandHandler.validateProject()),
      vscode.commands.registerCommand('r-best-practices.validateFile', () => commandHandler.validateFile()),
      vscode.commands.registerCommand('r-best-practices.generateTemplate', () => commandHandler.generateTemplate()),
      vscode.commands.registerCommand('r-best-practices.showReport', () => commandHandler.showReport(context)),
      vscode.commands.registerCommand('r-best-practices.toggleAutoValidation', () => commandHandler.toggleAutoValidation()),
    );

    // Set up auto-validation on file save
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (isRFile(document)) {
          const autoValidate = vscode.workspace.getConfiguration('r-best-practices').get<boolean>('autoValidate', true);
          if (autoValidate) {
            vscode.commands.executeCommand('r-best-practices.validate').catch((error) => {
              outputChannel.appendLine(`Auto-validation error: ${error}`);
            });
          }
        }
      }),
    );

    // Set up workspace change listener for diagnostics update
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('r-best-practices')) {
          outputChannel.appendLine('Configuration changed, refreshing diagnostics...');
          diagnosticsProvider.refresh();
        }
      }),
    );

    outputChannel.appendLine('R Best Practices extension activated successfully');
  } catch (error) {
    outputChannel.appendLine(`Activation error: ${error}`);
    vscode.window.showErrorMessage(`R Best Practices: Failed to activate extension - ${error}`);
  }
}

export function deactivate() {
  if (client) {
    client.disconnect();
  }
}

function isRFile(document: vscode.TextDocument): boolean {
  const languageId = document.languageId;
  const fileName = document.fileName;
  return (
    languageId === 'r' ||
    fileName.endsWith('.R') ||
    fileName.endsWith('.r') ||
    fileName.endsWith('.Rmd') ||
    fileName.endsWith('.qmd') ||
    fileName.endsWith('DESCRIPTION')
  );
}
