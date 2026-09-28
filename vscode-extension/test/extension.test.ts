import * as assert from 'assert';
import * as vscode from 'vscode';
import { extension } from '../src/extension';

suite('Extension Tests', () => {
  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('alexseymer.r-best-practices'));
  });

  test('Extension should activate', async () => {
    const ext = vscode.extensions.getExtension('alexseymer.r-best-practices');
    assert.ok(ext);

    if (!ext?.isActive) {
      await ext?.activate();
    }

    assert.ok(ext?.isActive);
  });

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands();

    assert.ok(commands.includes('r-best-practices.detect'));
    assert.ok(commands.includes('r-best-practices.validate'));
    assert.ok(commands.includes('r-best-practices.validateFile'));
    assert.ok(commands.includes('r-best-practices.generateTemplate'));
    assert.ok(commands.includes('r-best-practices.showReport'));
    assert.ok(commands.includes('r-best-practices.toggleAutoValidation'));
  });
});
