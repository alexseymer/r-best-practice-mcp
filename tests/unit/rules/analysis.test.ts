import fs from 'fs';
import os from 'os';
import path from 'path';
import { createTempDir, cleanupTempDir, createDir } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';
import { hasGitRepo } from '../../../src/engine/rules/analysis';

describe('analysis rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe('hasGitRepo', () => {
    it('finds .git in the directory itself', async () => {
      createDir(dir, '.git');
      expect(await hasGitRepo(dir, dir)).toBe(true);
    });

    it('accepts a .git file (worktrees, submodules)', async () => {
      fs.writeFileSync(path.join(dir, '.git'), 'gitdir: elsewhere\n');
      expect(await hasGitRepo(dir, dir)).toBe(true);
    });

    it('walks up through parents', async () => {
      createDir(dir, '.git');
      const deep = createDir(dir, 'a/b/c');
      expect(await hasGitRepo(deep, dir)).toBe(true);
    });

    it('stops at stopAt (inclusive)', async () => {
      createDir(dir, '.git');
      const deep = createDir(dir, 'a/b');
      expect(await hasGitRepo(deep, path.join(dir, 'a'))).toBe(false);
      createDir(dir, 'a/.git');
      expect(await hasGitRepo(deep, path.join(dir, 'a'))).toBe(true);
    });

    it('returns false when nothing is found up to stopAt', async () => {
      const deep = createDir(dir, 'a/b');
      expect(await hasGitRepo(deep, dir)).toBe(false);
    });
  });

  describe('analysis-versioning', () => {
    it('is satisfied by a .git directory in the project', async () => {
      createDir(dir, '.git');
      expect(await idsFor(dir, 'analysis')).not.toContain('analysis-versioning');
    });

    it('reports an analysis with no repository above it', async () => {
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-versioning-'));
      try {
        // The OS temp dir is normally outside any repository; if this machine
        // keeps it inside one, the rule must stay silent instead.
        const repoAbove = await hasGitRepo(outside);
        const findings = await findingsFor(outside, 'analysis');
        const finding = findings.find((f) => f.id === 'analysis-versioning');
        expect(finding !== undefined).toBe(!repoAbove);
        if (finding) {
          expect(finding.severity).toBe('important');
          expect(finding.category).toBe('structure');
          expect(finding.message.length).toBeGreaterThan(0);
          expect(finding.suggestions!.length).toBeGreaterThan(0);
        }
      } finally {
        cleanupTempDir(outside);
      }
    });
  });
});
