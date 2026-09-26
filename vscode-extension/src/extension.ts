import * as vscode from 'vscode';
import { RPracticesClient } from './client';
import { DiagnosticsManager } from './diagnostics';
import { CommandHandler } from './commands';

let client: RPracticesClient;
let diagnosticsManager: DiagnosticsManager;
let commandHandler: CommandHandler;

export async function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('r-practices');

  if (!config.get<boolean>('enabled')) {
    return;
  }

  console.log('R Best Practices extension activating...');

  // Initialize client
  client = new RPracticesClient(config);
  await client.connect();

  // Initialize diagnostics manager
  diagnosticsManager = new DiagnosticsManager();

  // Initialize command handler
  commandHandler = new CommandHandler(client, diagnosticsManager);

  // Register commands
  registerCommands(context, commandHandler);

  // Register event listeners
  registerEventListeners(context, client, diagnosticsManager, config);

  // Validate on open if configured
  if (config.get<boolean>('validateOnOpen')) {
    await validateWorkspace();
  }

  console.log('R Best Practices extension activated');
}

function registerCommands(context: vscode.ExtensionContext, handler: CommandHandler) {
  context.subscriptions.push(
    vscode.commands.registerCommand('r-practices.validate', () => handler.validate()),
    vscode.commands.registerCommand('r-practices.detectWorkflow', () => handler.detectWorkflow()),
    vscode.commands.registerCommand('r-practices.generateTemplate', () => handler.generateTemplate()),
    vscode.commands.registerCommand('r-practices.showReport', () => handler.showReport()),
    vscode.commands.registerCommand('r-practices.fixIssue', (diagnostic: vscode.Diagnostic) =>
      handler.fixIssue(diagnostic)
    )
  );
}

function registerEventListeners(
  context: vscode.ExtensionContext,
  client: RPracticesClient,
  diagnosticsManager: DiagnosticsManager,
  config: vscode.WorkspaceConfiguration
) {
  // Validate on file save
  if (config.get<boolean>('validateOnSave')) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(async () => {
        if (vscode.workspace.workspaceFolders) {
          await validateWorkspace();
        }
      })
    );
  }

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('r-practices')) {
        vscode.window.showInformationMessage('R Practices configuration changed. Please reload window.');
      }
    })
  );

  // Watch for file changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (e) => {
      const doc = e.document;
      if (isRFile(doc.fileName)) {
        // Validate single file with slight delay to avoid too frequent calls
        setTimeout(async () => {
          const findings = await client.validateFile(doc.fileName);
          diagnosticsManager.setDiagnostics(doc.uri, findings);
        }, 500);
      }
    })
  );
}

async function validateWorkspace() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return;

  for (const folder of workspaceFolders) {
    try {
      const findings = await client.validateProject(folder.uri.fsPath);
      diagnosticsManager.setProjectDiagnostics(folder.uri, findings);
    } catch (error) {
      vscode.window.showErrorMessage(`R Practices validation error: ${error}`);
    }
  }
}

function isRFile(fileName: string): boolean {
  return /\.(R|r|Rmd|rmd|qmd)$/.test(fileName);
}

export async function deactivate() {
  if (client) {
    await client.disconnect();
  }
}
