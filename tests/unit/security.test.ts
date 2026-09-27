import { SecurityUtils } from '../../src/utils/security';

describe('SecurityUtils', () => {
  describe('validatePath', () => {
    it('should allow valid paths within base directory', () => {
      const basePath = '/projects/myproject';
      const validPath = 'src/file.R';
      const result = SecurityUtils.validatePath(basePath, validPath);
      expect(result).toContain('myproject');
      expect(result).toContain('src');
    });

    it('should reject directory traversal attempts (.., /../)', () => {
      const basePath = '/projects/myproject';
      expect(() => {
        SecurityUtils.validatePath(basePath, '../../../etc/passwd');
      }).toThrow('Path traversal detected');
    });

    it('should reject absolute paths outside base', () => {
      const basePath = '/projects/myproject';
      expect(() => {
        SecurityUtils.validatePath(basePath, '/etc/passwd');
      }).toThrow('Path traversal detected');
    });

    it('should handle encoded traversal attempts', () => {
      const basePath = '/projects/myproject';
      // Even with encoding, after normalization it should still be caught
      const encodedPath = '..%2F..%2Fetc%2Fpasswd';
      const result = SecurityUtils.validatePath(basePath, encodedPath);
      expect(result).toContain('myproject');
    });

    it('should reject empty paths', () => {
      const basePath = '/projects/myproject';
      expect(() => {
        SecurityUtils.validatePath(basePath, '');
      }).toThrow('Invalid path');
    });

    it('should reject non-string paths', () => {
      const basePath = '/projects/myproject';
      expect(() => {
        SecurityUtils.validatePath(basePath, null as any);
      }).toThrow('Invalid path');
    });
  });

  describe('sanitizeInput', () => {
    it('should remove shell metacharacters', () => {
      const input = 'my<script>alert("xss")</script>project';
      const result = SecurityUtils.sanitizeInput(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('"');
    });

    it('should preserve valid characters', () => {
      const input = 'my-project_123';
      const result = SecurityUtils.sanitizeInput(input);
      expect(result).toBe('my-project_123');
    });

    it('should limit length to 1024 characters', () => {
      const input = 'a'.repeat(2000);
      const result = SecurityUtils.sanitizeInput(input);
      expect(result.length).toBeLessThanOrEqual(1024);
    });

    it('should trim whitespace', () => {
      const input = '  my project  ';
      const result = SecurityUtils.sanitizeInput(input);
      expect(result).toBe('my project');
    });

    it('should return empty string for non-string input', () => {
      const result = SecurityUtils.sanitizeInput(null as any);
      expect(result).toBe('');
    });

    it('should remove pipe characters', () => {
      const input = 'echo "test" | rm -rf /';
      const result = SecurityUtils.sanitizeInput(input);
      expect(result).not.toContain('|');
    });

    it('should remove asterisk and question mark', () => {
      const input = 'file*.txt?';
      const result = SecurityUtils.sanitizeInput(input);
      expect(result).toBe('file.txt');
    });
  });

  describe('isValidFilePath', () => {
    it('should accept valid file paths', () => {
      expect(SecurityUtils.isValidFilePath('/path/to/file.R')).toBe(true);
      expect(SecurityUtils.isValidFilePath('file.txt')).toBe(true);
      expect(SecurityUtils.isValidFilePath('./relative/path.md')).toBe(true);
    });

    it('should reject paths with null bytes', () => {
      expect(SecurityUtils.isValidFilePath('file.txt\0.R')).toBe(false);
    });

    it('should reject paths exceeding 4096 characters', () => {
      const longPath = 'a'.repeat(4097);
      expect(SecurityUtils.isValidFilePath(longPath)).toBe(false);
    });

    it('should accept paths at 4096 character limit', () => {
      const maxPath = 'a'.repeat(4096);
      expect(SecurityUtils.isValidFilePath(maxPath)).toBe(true);
    });

    it('should reject empty paths', () => {
      expect(SecurityUtils.isValidFilePath('')).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(SecurityUtils.isValidFilePath(null as any)).toBe(false);
      expect(SecurityUtils.isValidFilePath(undefined as any)).toBe(false);
      expect(SecurityUtils.isValidFilePath(123 as any)).toBe(false);
    });
  });

  describe('isValidWorkflow', () => {
    it('should accept all valid workflow types', () => {
      const validWorkflows = [
        'r-script',
        'quarto',
        'shiny',
        'package',
        'rmarkdown',
        'renv',
        'targets',
        'plumber',
        'analysis',
        'bookdown',
        'blogdown',
        'shinytest',
      ];
      validWorkflows.forEach((workflow) => {
        expect(SecurityUtils.isValidWorkflow(workflow)).toBe(true);
      });
    });

    it('should reject invalid workflow types', () => {
      expect(SecurityUtils.isValidWorkflow('invalid')).toBe(false);
      expect(SecurityUtils.isValidWorkflow('r-package')).toBe(false);
      expect(SecurityUtils.isValidWorkflow('')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(SecurityUtils.isValidWorkflow('PACKAGE')).toBe(false);
      expect(SecurityUtils.isValidWorkflow('Package')).toBe(false);
    });
  });

  describe('getClientIp', () => {
    it('should extract IP from X-Forwarded-For header', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
        socket: { remoteAddress: '127.0.0.1' },
      };
      const ip = SecurityUtils.getClientIp(req);
      expect(ip).toBe('192.168.1.1');
    });

    it('should fallback to X-Real-IP header', () => {
      const req = {
        headers: { 'x-real-ip': '192.168.1.2' },
        socket: { remoteAddress: '127.0.0.1' },
      };
      const ip = SecurityUtils.getClientIp(req);
      expect(ip).toBe('192.168.1.2');
    });

    it('should fallback to socket remoteAddress', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.3' },
      };
      const ip = SecurityUtils.getClientIp(req);
      expect(ip).toBe('192.168.1.3');
    });

    it('should return "unknown" when no IP found', () => {
      const req = { headers: {}, socket: {} };
      const ip = SecurityUtils.getClientIp(req);
      expect(ip).toBe('unknown');
    });
  });

  describe('validateBodySize', () => {
    it('should allow requests under max size', () => {
      expect(SecurityUtils.validateBodySize(1000000, 52428800)).toBe(true);
    });

    it('should reject requests over max size', () => {
      expect(SecurityUtils.validateBodySize(60000000, 52428800)).toBe(false);
    });

    it('should allow requests at max size limit', () => {
      expect(SecurityUtils.validateBodySize(52428800, 52428800)).toBe(true);
    });

    it('should allow undefined content-length', () => {
      expect(SecurityUtils.validateBodySize(undefined, 52428800)).toBe(true);
    });

    it('should use custom max size', () => {
      expect(SecurityUtils.validateBodySize(1000, 500)).toBe(false);
      expect(SecurityUtils.validateBodySize(400, 500)).toBe(true);
    });
  });
});
