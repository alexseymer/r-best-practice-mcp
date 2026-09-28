import * as fs from 'fs';
import * as path from 'path';
import { FileUtils } from '../utils/file';
import { globalCache } from '../utils/cache';

export interface Dependency {
  name: string;
  version?: string;
  required: boolean;
  source: 'description' | 'namespace' | 'imports' | 'suggests';
  used: boolean;
}

export interface DependencyIssue {
  package: string;
  issue: 'unused' | 'missing' | 'orphaned' | 'security' | 'outdated' | 'conflict';
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion: string;
}

export interface DependencyAnalysis {
  totalDependencies: number;
  usedDependencies: number;
  unusedDependencies: string[];
  missingDependencies: string[];
  issues: DependencyIssue[];
}

export class DependencyAnalyzer {
  private declaredDependencies: Set<string> = new Set();
  private usedDependencies: Set<string> = new Set();

  async analyzeProject(projectPath: string): Promise<DependencyAnalysis> {
    const cacheKey = `dependency:project:${projectPath}`;
    const cached = globalCache.get<DependencyAnalysis>(cacheKey);
    if (cached) return cached;

    this.declaredDependencies.clear();
    this.usedDependencies.clear();

    // Parse DESCRIPTION file for declared dependencies
    await this.parseDependencies(projectPath);

    // Parse R files for used packages
    await this.parseUsedPackages(projectPath);

    const result = this.generateAnalysis();
    globalCache.set(cacheKey, result, 120000); // 2 minute cache
    return result;
  }

  private async parseDependencies(projectPath: string): Promise<void> {
    const descPath = path.join(projectPath, 'DESCRIPTION');
    if (!(await FileUtils.exists(descPath))) {
      return;
    }

    try {
      const content = await FileUtils.readFile(descPath);
      const lines = content.split('\n');
      let currentField = '';

      for (const line of lines) {
        if (/^[A-Z][a-zA-Z-]+:/.test(line)) {
          const [field] = line.split(':');
          currentField = field;
        }

        if (currentField === 'Depends' || currentField === 'Imports' || currentField === 'Suggests') {
          const packages = this.parsePackageList(line);
          packages.forEach((pkg) => this.declaredDependencies.add(pkg));
        }
      }
    } catch (error) {
      console.warn(`Failed to parse DESCRIPTION: ${error}`);
    }
  }

  private parsePackageList(line: string): string[] {
    const packages: string[] = [];

    if (line.includes(':')) {
      line = line.split(':')[1];
    }

    const items = line.split(',');
    for (const item of items) {
      const match = item.trim().match(/^([a-zA-Z0-9_.]+)/);
      if (match) {
        packages.push(match[1]);
      }
    }

    return packages;
  }

  private async parseUsedPackages(projectPath: string): Promise<void> {
    const rFiles = await FileUtils.listFiles(projectPath, '**/*.R', true);

    for (const file of rFiles) {
      try {
        const content = await FileUtils.readFile(file);
        this.extractPackageUsage(content);
      } catch (error) {
        console.warn(`Failed to parse ${file}: ${error}`);
      }
    }
  }

  private extractPackageUsage(content: string): void {
    const patterns = [
      /library\(["']([^"']+)["']\)/g,
      /require\(["']([^"']+)["']\)/g,
      /(\w+)::/g,
      /library\(([^,)]+)\)/g,
      /require\(([^,)]+)\)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const pkg = match[1].trim().replace(/["']/g, '');
        if (pkg && pkg.length > 0) {
          this.usedDependencies.add(pkg);
        }
      }
    }
  }

  private generateAnalysis(): DependencyAnalysis {
    const unused: string[] = [];
    const missing: string[] = [];

    for (const dep of this.declaredDependencies) {
      if (!this.usedDependencies.has(dep)) {
        unused.push(dep);
      }
    }

    for (const used of this.usedDependencies) {
      if (!this.declaredDependencies.has(used) && !this.isBasePackage(used)) {
        missing.push(used);
      }
    }

    const issues: DependencyIssue[] = [];

    for (const pkg of unused) {
      issues.push({
        package: pkg,
        issue: 'unused',
        severity: 'warning',
        message: `Package '${pkg}' is declared but not used`,
        suggestion: `Remove '${pkg}' from DESCRIPTION or add usage in code`,
      });
    }

    for (const pkg of missing) {
      issues.push({
        package: pkg,
        issue: 'missing',
        severity: 'error',
        message: `Package '${pkg}' is used but not declared in DESCRIPTION`,
        suggestion: `Add '${pkg}' to Imports in DESCRIPTION file`,
      });
    }

    return {
      totalDependencies: this.declaredDependencies.size,
      usedDependencies: this.usedDependencies.size,
      unusedDependencies: unused,
      missingDependencies: missing,
      issues,
    };
  }

  private isBasePackage(name: string): boolean {
    const basePackages = new Set([
      'base',
      'stats',
      'graphics',
      'grDevices',
      'utils',
      'datasets',
      'methods',
      'parallel',
      'tools',
      'grid',
      'compiler',
      'splines',
      'tcltk',
    ]);
    return basePackages.has(name);
  }

  async suggestUpdates(projectPath: string): Promise<Array<{ package: string; currentVersion?: string; latestVersion: string; recommendation: string }>> {
    const updates: Array<{ package: string; currentVersion?: string; latestVersion: string; recommendation: string }> = [];

    for (const pkg of this.declaredDependencies) {
      try {
        const currentVersion = await this.getInstalledVersion(pkg);
        const latestVersion = await this.getLatestVersion(pkg);

        if (currentVersion && latestVersion && this.isNewerVersion(latestVersion, currentVersion)) {
          updates.push({
            package: pkg,
            currentVersion,
            latestVersion,
            recommendation: `Update ${pkg} from ${currentVersion} to ${latestVersion}`,
          });
        }
      } catch (error) {
        console.warn(`Failed to check updates for ${pkg}: ${error}`);
      }
    }

    return updates;
  }

  private async getInstalledVersion(packageName: string): Promise<string | undefined> {
    // This would typically call R to get the version
    // For now, return undefined as we don't have R runtime
    return undefined;
  }

  private async getLatestVersion(packageName: string): Promise<string> {
    // This would typically call CRAN API or similar
    // For now, return a placeholder
    return '1.0.0';
  }

  private isNewerVersion(v1: string, v2: string): boolean {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 > p2) return true;
      if (p1 < p2) return false;
    }

    return false;
  }
}
