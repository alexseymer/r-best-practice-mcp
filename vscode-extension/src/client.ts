import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface Finding {
  id: string;
  severity: 'critical' | 'important' | 'recommended' | 'info';
  category: string;
  message: string;
  suggestions?: string[];
  file?: string;
  line?: number;
}

interface ValidationResult {
  workflow: string;
  findings: Finding[];
  duration: number;
}

export class RPracticesClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: vscode.WorkspaceConfiguration;
  private messageQueue: Array<{ resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = [];
  private messageId = 0;

  constructor(config: vscode.WorkspaceConfiguration) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const serverPath = this.config.get<string>('serverPath') || 'r-practices';

      try {
        // Try to spawn the server process
        this.process = spawn(serverPath, ['server'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        });

        this.process.on('error', (error) => {
          console.error('Failed to spawn R Practices server:', error);
          reject(new Error(`Failed to connect to R Practices server: ${error.message}`));
        });

        this.process.stdout?.on('data', (data) => {
          this.handleResponse(data.toString());
        });

        this.process.stderr?.on('data', (data) => {
          console.error('R Practices server error:', data.toString());
        });

        // Simple test to see if server is responding
        setTimeout(() => {
          resolve();
        }, 1000);
      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  async validateProject(projectPath: string): Promise<Finding[]> {
    const result = await this.callTool('validate_project', {
      path: projectPath,
    });
    return result.data?.findings || [];
  }

  async validateFile(filePath: string): Promise<Finding[]> {
    const result = await this.callTool('validate_file', {
      path: filePath,
    });
    return result.data?.findings || [];
  }

  async detectWorkflow(projectPath: string): Promise<{ workflow: string; confidence: number; indicators: string[] }> {
    const result = await this.callTool('detect_workflow', {
      path: projectPath,
    });
    return result.data || { workflow: 'unknown', confidence: 0, indicators: [] };
  }

  async generateTemplate(
    workflow: string,
    options: { projectName?: string; authorName?: string; authorEmail?: string }
  ): Promise<any> {
    const result = await this.callTool('generate_template', {
      workflow,
      ...options,
    });
    return result.data;
  }

  async getPractice(id: string): Promise<any> {
    const result = await this.callTool('get_practice', { id });
    return result.data;
  }

  async listPractices(options: { workflow?: string; category?: string }): Promise<any> {
    const result = await this.callTool('list_practices', options);
    return result.data;
  }

  private async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;

      const timeout = setTimeout(() => {
        this.removeMessageHandler(id);
        reject(new Error(`Tool call timeout: ${toolName}`));
      }, 30000);

      this.messageQueue.push({ resolve, reject, timeout });

      const request = {
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      };

      if (this.process && this.process.stdin) {
        this.process.stdin.write(JSON.stringify(request) + '\n');
      } else {
        clearTimeout(timeout);
        this.removeMessageHandler(id);
        reject(new Error('MCP server not connected'));
      }
    });
  }

  private handleResponse(data: string) {
    const lines = data.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      try {
        const message = JSON.parse(line);

        if (message.id && message.id > 0) {
          const handler = this.messageQueue.find((h) => h.timeout);

          if (handler) {
            clearTimeout(handler.timeout);
            this.removeMessageHandler(message.id);

            if (message.error) {
              handler.reject(new Error(message.error.message));
            } else {
              handler.resolve(message.result);
            }
          }
        }
      } catch (error) {
        console.error('Failed to parse response:', error);
      }
    }
  }

  private removeMessageHandler(id: number) {
    const index = this.messageQueue.findIndex((h) => h.timeout);
    if (index >= 0) {
      this.messageQueue.splice(index, 1);
    }
  }
}
