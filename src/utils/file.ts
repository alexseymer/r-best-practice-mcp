import fs from 'fs';
import path from 'path';

export class FileUtils {
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(filePath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  static async readFile(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf-8');
  }

  static async readFileLines(filePath: string): Promise<string[]> {
    const content = await this.readFile(filePath);
    return content.split('\n');
  }

  static async writeFile(filePath: string, content: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }

  static async listFiles(
    dirPath: string,
    pattern?: RegExp,
    recursive: boolean = false
  ): Promise<string[]> {
    const files: string[] = [];

    const traverse = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && recursive) {
          await traverse(fullPath);
        } else if (entry.isFile()) {
          if (!pattern || pattern.test(entry.name)) {
            files.push(fullPath);
          }
        }
      }
    };

    await traverse(dirPath);
    return files;
  }

  static getExtension(filePath: string): string {
    return path.extname(filePath);
  }

  static getBaseName(filePath: string): string {
    return path.basename(filePath);
  }

  static normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, '/');
  }
}
