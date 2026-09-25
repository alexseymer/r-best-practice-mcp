import { FileUtils } from '../../src/utils/file';
import { createTempDir, cleanupTempDir, createFile, createDir } from '../fixtures/setup';

describe('FileUtils', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      createFile(tempDir, 'test.txt', 'content');
      const exists = await FileUtils.exists(`${tempDir}/test.txt`);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await FileUtils.exists(`${tempDir}/nonexistent.txt`);
      expect(exists).toBe(false);
    });
  });

  describe('isDirectory', () => {
    it('should return true for directories', async () => {
      createDir(tempDir, 'subdir');
      const isDir = await FileUtils.isDirectory(`${tempDir}/subdir`);
      expect(isDir).toBe(true);
    });

    it('should return false for files', async () => {
      createFile(tempDir, 'test.txt', 'content');
      const isDir = await FileUtils.isDirectory(`${tempDir}/test.txt`);
      expect(isDir).toBe(false);
    });

    it('should return false for non-existent path', async () => {
      const isDir = await FileUtils.isDirectory(`${tempDir}/nonexistent`);
      expect(isDir).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read file content', async () => {
      const content = 'Hello World';
      createFile(tempDir, 'test.txt', content);
      const result = await FileUtils.readFile(`${tempDir}/test.txt`);
      expect(result).toBe(content);
    });

    it('should throw error for non-existent file', async () => {
      await expect(
        FileUtils.readFile(`${tempDir}/nonexistent.txt`)
      ).rejects.toThrow();
    });
  });

  describe('readFileLines', () => {
    it('should read file lines', async () => {
      const content = 'line1\nline2\nline3';
      createFile(tempDir, 'test.txt', content);
      const lines = await FileUtils.readFileLines(`${tempDir}/test.txt`);
      expect(lines.length).toBe(3);
      expect(lines[0]).toBe('line1');
    });
  });

  describe('writeFile', () => {
    it('should write file content', async () => {
      const filePath = `${tempDir}/subdir/test.txt`;
      const content = 'Test content';
      await FileUtils.writeFile(filePath, content);
      const result = await FileUtils.readFile(filePath);
      expect(result).toBe(content);
    });

    it('should create parent directories', async () => {
      const filePath = `${tempDir}/a/b/c/test.txt`;
      await FileUtils.writeFile(filePath, 'content');
      const exists = await FileUtils.exists(filePath);
      expect(exists).toBe(true);
    });
  });

  describe('listFiles', () => {
    it('should list files in directory', async () => {
      createFile(tempDir, 'file1.txt', '');
      createFile(tempDir, 'file2.txt', '');
      createFile(tempDir, 'file3.R', '');

      const files = await FileUtils.listFiles(tempDir);
      expect(files.length).toBe(3);
    });

    it('should filter by pattern', async () => {
      createFile(tempDir, 'file1.R', '');
      createFile(tempDir, 'file2.R', '');
      createFile(tempDir, 'file.txt', '');

      const files = await FileUtils.listFiles(tempDir, /\.R$/);
      expect(files.length).toBe(2);
      expect(files.every((f) => f.endsWith('.R'))).toBe(true);
    });

    it('should support recursive search', async () => {
      createFile(tempDir, 'file1.R', '');
      createFile(tempDir, 'subdir/file2.R', '');
      createFile(tempDir, 'subdir/nested/file3.R', '');

      const files = await FileUtils.listFiles(tempDir, /\.R$/, true);
      expect(files.length).toBe(3);
    });

    it('should skip hidden files and node_modules', async () => {
      createFile(tempDir, 'file.R', '');
      createFile(tempDir, '.hidden', '');
      createFile(tempDir, 'node_modules/package.json', '');

      const files = await FileUtils.listFiles(tempDir, undefined, true);
      expect(files.every((f) => !f.includes('.hidden') && !f.includes('node_modules'))).toBe(
        true
      );
    });
  });

  describe('getExtension', () => {
    it('should return file extension', () => {
      expect(FileUtils.getExtension('file.txt')).toBe('.txt');
      expect(FileUtils.getExtension('script.R')).toBe('.R');
      expect(FileUtils.getExtension('doc.qmd')).toBe('.qmd');
    });

    it('should return empty string for no extension', () => {
      expect(FileUtils.getExtension('Dockerfile')).toBe('');
    });
  });

  describe('getBaseName', () => {
    it('should return filename', () => {
      expect(FileUtils.getBaseName('/path/to/file.txt')).toBe('file.txt');
      expect(FileUtils.getBaseName('file.R')).toBe('file.R');
    });
  });

  describe('normalizePath', () => {
    it('should normalize path', () => {
      const normalized = FileUtils.normalizePath('/path\\to\\file.txt');
      expect(normalized).toBe('/path/to/file.txt');
    });
  });
});
