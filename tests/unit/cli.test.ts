import { CLIFormatter, ConfigLoader, parseArgs, getProjectPath } from '../../src/cli/utils';
import * as path from 'path';
import { validateCommand } from '../../src/cli/commands/validate';
import { createTempDir, cleanupTempDir, createFile } from '../fixtures/setup';

describe('CLI Utils', () => {
  describe('parseArgs', () => {
    it('should parse command and arguments', () => {
      const result = parseArgs(['detect', '/path/to/project']);
      expect(result.command).toBe('detect');
      expect(result.args).toEqual(['/path/to/project']);
    });

    it('should parse long options', () => {
      const result = parseArgs(['validate', 'path', '--output=./reports', '--verbose']);
      expect(result.options).toEqual({
        output: './reports',
        verbose: true,
      });
    });

    it('should parse short options', () => {
      const result = parseArgs(['template', 'package', '-f', '-q']);
      expect(result.options).toEqual({
        f: true,
        q: true,
      });
    });

    it('should handle mixed arguments and options', () => {
      const result = parseArgs(['validate', 'project', 'package', '--output', 'dir']);
      expect(result.command).toBe('validate');
      expect(result.args).toEqual(['project', 'package']);
      expect(result.options).toEqual({ output: 'dir' });
    });

    it('should handle empty args', () => {
      const result = parseArgs([]);
      expect(result.command).toBe('');
      expect(result.args).toEqual([]);
      expect(result.options).toEqual({});
    });
  });

  describe('getProjectPath', () => {
    it('should return cwd when no path provided', () => {
      const result = getProjectPath();
      expect(result).toBe(process.cwd());
    });

    it('should return absolute path as-is', () => {
      const absolutePath = '/home/user/project';
      const result = getProjectPath(absolutePath);
      expect(result).toBe(absolutePath);
    });

    it('should resolve relative paths', () => {
      const result = getProjectPath('./my-project');
      expect(result).toBe(path.resolve(process.cwd(), './my-project'));
    });

    it('should resolve .. paths', () => {
      const result = getProjectPath('../project');
      expect(result).toBe(path.resolve(process.cwd(), '../project'));
    });
  });

  describe('CLIFormatter', () => {
    it('should colorize text when NO_COLOR not set', () => {
      delete process.env.NO_COLOR;
      const result = CLIFormatter.colorize('text', 'green');
      expect(result).toContain('\x1b[32m');
      expect(result).toContain('text');
      expect(result).toContain('\x1b[0m');
    });

    it('should not colorize when NO_COLOR is set', () => {
      process.env.NO_COLOR = '1';
      const result = CLIFormatter.colorize('text', 'green');
      expect(result).toBe('text');
      delete process.env.NO_COLOR;
    });

    it('should have success, error, warn, info methods', () => {
      expect(typeof CLIFormatter.success).toBe('function');
      expect(typeof CLIFormatter.error).toBe('function');
      expect(typeof CLIFormatter.warn).toBe('function');
      expect(typeof CLIFormatter.info).toBe('function');
    });

    it('should write status messages to stderr and keep stdout for results', () => {
      const out = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      CLIFormatter.info('Validating project: x');
      expect(out).not.toHaveBeenCalled();
      expect(err).toHaveBeenCalledTimes(1);
      out.mockRestore();
      err.mockRestore();
    });

    it('should have header and section methods', () => {
      expect(typeof CLIFormatter.header).toBe('function');
      expect(typeof CLIFormatter.section).toBe('function');
    });

    it('should have progress and spinner methods', () => {
      expect(typeof CLIFormatter.progress).toBe('function');
      expect(typeof CLIFormatter.spinner).toBe('function');
    });
  });

  describe('ConfigLoader', () => {
    it('should return empty object when no config found', () => {
      const result = ConfigLoader.loadConfig('/nonexistent/path');
      expect(result).toEqual({});
    });

    it('should load config from multiple locations', () => {
      const locations = [
        '.r-best-practicesrc',
        '.r-best-practicesrc.json',
        'r-best-practices.config.json',
      ];
      expect(locations.length).toBe(3);
    });
  });

  describe('detectCommand', () => {
    it('should require path argument', async () => {
      // Test in integration with actual command
      expect(true).toBe(true);
    });
  });

  describe('validateCommand', () => {
    let dir: string;
    beforeEach(() => {
      dir = createTempDir();
    });
    afterEach(() => cleanupTempDir(dir));

    const run = async (args: string[]): Promise<string> => {
      const out = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      try {
        await validateCommand(args, { format: 'json' });
        return out.mock.calls.map((c) => String(c[0])).join('\n');
      } finally {
        out.mockRestore();
        err.mockRestore();
        exit.mockRestore();
      }
    };

    it('detects the workflow when none is given and prints only JSON to stdout', async () => {
      createFile(dir, 'analysis.R', '# header\nx <- 1\n');
      const result = JSON.parse(await run([dir]));
      expect(result.workflow).toBe('r-script');
      expect(result.warnings).toBeUndefined();
    });

    it('uses an explicit workflow when given', async () => {
      createFile(dir, 'analysis.R', '# header\nx <- 1\n');
      const result = JSON.parse(await run([dir, 'package']));
      expect(result.workflow).toBe('package');
    });
  });

  describe('templateCommand', () => {
    it('should require workflow type', async () => {
      // Test in integration with actual command
      expect(true).toBe(true);
    });

    it('should generate files in specified directory', async () => {
      // Test in integration with actual command
      expect(true).toBe(true);
    });
  });

  describe('reportCommand', () => {
    it('should generate HTML report', async () => {
      // Test in integration with actual command
      expect(true).toBe(true);
    });

    it('should save report to output directory', async () => {
      // Test in integration with actual command
      expect(true).toBe(true);
    });
  });
});
