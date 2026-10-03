import fs from 'fs';
import os from 'os';
import path from 'path';
import { findingsFor, idsFor } from '../../fixtures/rules';
import { hasGitRepo } from '../../../src/engine/rules/analysis';

/**
 * These fixtures live in the OS temp dir, not in the repository's own tests/.temp, so the walk up
 * from them never meets this repository's .git by accident.
 *
 * hasGitRepo(dirPath, stopAt): true if dirPath, or any parent up to and INCLUDING stopAt, contains
 * a `.git` entry (directory or file). Without stopAt the walk continues to the filesystem root.
 */
describe('analysis rules', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rbp-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const mkdir = (...parts: string[]): string => {
    const dir = path.join(root, ...parts);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  describe('hasGitRepo', () => {
    it('finds a .git directory at the project itself', async () => {
      const project = mkdir('project');
      mkdir('project', '.git');
      expect(await hasGitRepo(project, project)).toBe(true);
      expect(await hasGitRepo(project, root)).toBe(true);
    });

    it('accepts a .git file (worktrees, submodules)', async () => {
      const project = mkdir('project');
      fs.writeFileSync(path.join(project, '.git'), 'gitdir: ../elsewhere\n');
      expect(await hasGitRepo(project, project)).toBe(true);
    });

    it('finds a .git at a parent below stopAt', async () => {
      mkdir('repo', '.git');
      const project = mkdir('repo', 'analyses', 'one');
      expect(await hasGitRepo(project, root)).toBe(true);
      expect(await hasGitRepo(project, path.join(root, 'repo'))).toBe(true);
    });

    it('does not look above stopAt', async () => {
      mkdir('.git'); // above stopAt
      const project = mkdir('outer', 'project');
      expect(await hasGitRepo(project, path.join(root, 'outer'))).toBe(false);
    });

    it('returns false when there is no .git up to stopAt', async () => {
      const project = mkdir('a', 'b', 'c');
      expect(await hasGitRepo(project, path.join(root, 'a'))).toBe(false);
      expect(await hasGitRepo(project, project)).toBe(false);
    });

    it('counts a .git inside stopAt itself (inclusive)', async () => {
      const stop = mkdir('stop');
      mkdir('stop', '.git');
      const project = mkdir('stop', 'x', 'y');
      expect(await hasGitRepo(project, stop)).toBe(true);
    });

    it('does not count a .git directory inside a sibling directory', async () => {
      mkdir('sibling', '.git');
      const project = mkdir('project');
      expect(await hasGitRepo(project, root)).toBe(false);
    });

    it('resolves non-normalised paths', async () => {
      mkdir('project', '.git');
      mkdir('project', 'sub');
      const messy = path.join(root, 'project', 'sub', '..');
      expect(await hasGitRepo(messy, messy)).toBe(true);
    });

    it('returns false for a missing directory when stopAt bounds the walk', async () => {
      const missing = path.join(root, 'does', 'not', 'exist');
      expect(await hasGitRepo(missing, root)).toBe(false);
    });
  });

  describe('analysis-versioning', () => {
    it('is satisfied by a .git directory in the project', async () => {
      const project = mkdir('project');
      mkdir('project', '.git');
      expect(await idsFor(project, 'analysis')).not.toContain('analysis-versioning');
    });

    it('is satisfied by a .git file in the project', async () => {
      const project = mkdir('project');
      fs.writeFileSync(path.join(project, '.git'), 'gitdir: ../x\n');
      expect(await idsFor(project, 'analysis')).not.toContain('analysis-versioning');
    });

    it('is satisfied by a repository above the project', async () => {
      mkdir('repo', '.git');
      const project = mkdir('repo', 'analysis');
      expect(await idsFor(project, 'analysis')).not.toContain('analysis-versioning');
    });

    it('reports the practice metadata when no repository exists (skipped if the machine has one)', async () => {
      const project = mkdir('project');
      // Only deterministic when the OS temp dir is outside any repository.
      if (await hasGitRepo(project)) return;
      const found = (await findingsFor(project, 'analysis')).filter(
        (f) => f.id === 'analysis-versioning'
      );
      expect(found).toHaveLength(1);
      expect(found[0].severity).toBe('important');
      expect(found[0].category).toBe('structure');
      expect(found[0].message).toContain('no .git');
      expect(found[0].suggestions?.length).toBeGreaterThan(0);
    });
  });
});
