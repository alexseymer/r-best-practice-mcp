import { logger } from '../utils/logger.js';
import { FileUtils } from '../utils/file.js';

export interface Dependency {
  name: string;
  version?: string;
  type: 'import' | 'require' | 'library' | 'renv' | 'description';
  source?: string;
  status: 'installed' | 'missing' | 'outdated';
}

export interface DependencyReport {
  filePath: string;
  dependencies: Dependency[];
  renvLock?: Map<string, string>;
  descriptionDeps?: string[];
}

export class DependencyAnalyzer {
  async analyzeProject(projectPath: string): Promise<DependencyReport[]> {
    const reports: DependencyReport[] = [];

    // Find all R files
    const rFiles = await FileUtils.listFiles(projectPath, /\.(R|Rmd|qmd)$/, true);

    for (const file of rFiles) {
      const content = await FileUtils.readFile(file);
      reports.push({
        filePath: file,
        dependencies: this.extractDependencies(content, file),
      });
    }

    // Check for renv.lock if it exists
    const renvLockPath = `${projectPath}/renv.lock`;
    if (await FileUtils.exists(renvLockPath)) {
      try {
        const lockContent = await FileUtils.readFile(renvLockPath);
        const renvDeps = this.parseRenvLock(lockContent);
        if (reports.length > 0) {
          reports[0].renvLock = renvDeps;
        }
      } catch (error) {
        logger.warn(`Failed to parse renv.lock: ${error}`);
      }
    }

    // Check DESCRIPTION file if it exists
    const descriptionPath = `${projectPath}/DESCRIPTION`;
    if (await FileUtils.exists(descriptionPath)) {
      try {
        const descContent = await FileUtils.readFile(descriptionPath);
        const descDeps = this.parseDescription(descContent);
        if (reports.length > 0) {
          reports[0].descriptionDeps = descDeps;
        }
      } catch (error) {
        logger.warn(`Failed to parse DESCRIPTION: ${error}`);
      }
    }

    return reports;
  }

  private extractDependencies(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];
    const seen = new Set<string>();

    // library() calls
    const libraryPattern = /library\s*\(\s*['"]*([a-zA-Z0-9._]+)['"]*\s*\)/g;
    let match;
    while ((match = libraryPattern.exec(content)) !== null) {
      const name = match[1];
      if (!seen.has(name)) {
        dependencies.push({ name, type: 'library', status: 'installed' });
        seen.add(name);
      }
    }

    // require() calls
    const requirePattern = /require\s*\(\s*['"]*([a-zA-Z0-9._]+)['"]*\s*\)/g;
    while ((match = requirePattern.exec(content)) !== null) {
      const name = match[1];
      if (!seen.has(name)) {
        dependencies.push({ name, type: 'require', status: 'installed' });
        seen.add(name);
      }
    }

    // import statements (for packages using roxygen)
    const importPattern = /#'\s*@import\s+([a-zA-Z0-9._]+)/g;
    while ((match = importPattern.exec(content)) !== null) {
      const name = match[1];
      if (!seen.has(name)) {
        dependencies.push({ name, type: 'import', status: 'installed' });
        seen.add(name);
      }
    }

    // importFrom statements
    const importFromPattern = /#'\s*@importFrom\s+([a-zA-Z0-9._]+)\s+([a-zA-Z0-9_.]+)/g;
    while ((match = importFromPattern.exec(content)) !== null) {
      const pkg = match[1];
      const fn = match[2];
      if (!seen.has(pkg)) {
        dependencies.push({ name: pkg, type: 'import', source: fn, status: 'installed' });
        seen.add(pkg);
      }
    }

    return dependencies;
  }

  private parseRenvLock(content: string): Map<string, string> {
    const deps = new Map<string, string>();

    try {
      // Simple JSON parsing for renv.lock
      const lines = content.split('\n');
      let currentPackage = '';

      for (const line of lines) {
        // Look for package names and versions
        const packageMatch = line.match(/"(\w+)": \{/);
        if (packageMatch) {
          currentPackage = packageMatch[1];
        }

        const versionMatch = line.match(/"Version": "([^"]+)"/);
        if (versionMatch && currentPackage) {
          deps.set(currentPackage, versionMatch[1]);
        }
      }
    } catch (error) {
      logger.warn(`Failed to parse renv.lock: ${error}`);
    }

    return deps;
  }

  private parseDescription(content: string): string[] {
    const deps: string[] = [];

    // Extract Depends, Imports, Suggests
    const depFields = ['Depends:', 'Imports:', 'Suggests:'];

    for (const field of depFields) {
      const idx = content.indexOf(field);
      if (idx >= 0) {
        let end = content.indexOf('\n', idx);
        let depString = content.substring(idx + field.length, end);

        // Handle multi-line dependencies
        while (end < content.length && content[end + 1] === ' ') {
          end = content.indexOf('\n', end + 1);
          depString += ' ' + content.substring(idx + field.length, end).trim();
        }

        // Parse comma-separated dependencies
        const packageList = depString.split(',').map((p) => {
          // Extract just the package name (remove version constraints)
          const match = p.match(/\s*([a-zA-Z0-9._]+)/);
          return match ? match[1] : '';
        });

        deps.push(...packageList.filter((p) => p.length > 0));
      }
    }

    return [...new Set(deps)]; // Remove duplicates
  }

  getRecommendations(report: DependencyReport): string[] {
    const recommendations: string[] = [];

    // Check for unused dependencies
    if (report.descriptionDeps && report.descriptionDeps.length > 0) {
      const usedInFile = report.dependencies.map((d) => d.name);
      const unused = report.descriptionDeps.filter((d) => !usedInFile.includes(d));

      if (unused.length > 0) {
        recommendations.push(`Consider removing unused dependencies: ${unused.join(', ')}`);
      }
    }

    // Check for missing dependencies
    const fileDeps = report.dependencies.map((d) => d.name);
    const describedDeps = report.descriptionDeps || [];
    const missing = fileDeps.filter((d) => !describedDeps.includes(d));

    if (missing.length > 0) {
      recommendations.push(`Add to DESCRIPTION: ${missing.join(', ')}`);
    }

    return recommendations;
  }
}
