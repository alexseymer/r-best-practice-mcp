import * as vscode from 'vscode';
import fetch from 'node-fetch';

export interface DetectionResult {
  workflow: string;
  confidence: number;
  indicators: string[];
}

export interface ValidationResult {
  error: boolean;
  data: {
    workflow: string;
    findings: Finding[];
    duration: number;
  };
  timestamp: number;
}

export interface Finding {
  id: string;
  severity: 'critical' | 'important' | 'recommended' | 'info';
  category: string;
  message: string;
  suggestions?: string[];
  file?: string;
  line?: number;
}

export class MCPClient {
  private serverUrl: string;
  private outputChannel: vscode.OutputChannel;
  private isConnected: boolean = false;

  constructor(serverPath: string, outputChannel: vscode.OutputChannel) {
    this.serverUrl = serverPath.startsWith('http') ? serverPath : `http://${serverPath}`;
    this.outputChannel = outputChannel;
  }

  async initialize(): Promise<void> {
    try {
      const response = await fetch(`${this.serverUrl}/health`, { timeout: 5000 });
      if (response.ok) {
        this.isConnected = true;
        this.outputChannel.appendLine(`Connected to R Best Practices server at ${this.serverUrl}`);
      } else {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (error) {
      this.outputChannel.appendLine(`Failed to connect to server: ${error}`);
      this.isConnected = false;
      throw error;
    }
  }

  async detectWorkflow(projectPath: string): Promise<DetectionResult> {
    const response = await fetch(`${this.serverUrl}/api/v1/detect-workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectPath }),
    });

    if (!response.ok) {
      throw new Error(`Detection failed: ${response.statusText}`);
    }

    const data = (await response.json()) as { data: DetectionResult };
    return data.data;
  }

  async validateProject(projectPath: string, workflow?: string): Promise<ValidationResult> {
    const response = await fetch(`${this.serverUrl}/api/v1/validate-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectPath, workflow }),
    });

    if (!response.ok) {
      throw new Error(`Validation failed: ${response.statusText}`);
    }

    return (await response.json()) as ValidationResult;
  }

  async validateFile(filePath: string): Promise<{ data: { path: string; findings: Finding[] } }> {
    const response = await fetch(`${this.serverUrl}/api/v1/validate-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    });

    if (!response.ok) {
      throw new Error(`File validation failed: ${response.statusText}`);
    }

    return (await response.json()) as { data: { path: string; findings: Finding[] } };
  }

  async generateTemplate(workflow: string, projectName: string): Promise<any> {
    const response = await fetch(`${this.serverUrl}/api/v1/generate-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow, projectName }),
    });

    if (!response.ok) {
      throw new Error(`Template generation failed: ${response.statusText}`);
    }

    return (await response.json()) as any;
  }

  disconnect(): void {
    this.isConnected = false;
    this.outputChannel.appendLine('Disconnected from R Best Practices server');
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}
