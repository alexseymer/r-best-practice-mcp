import path from 'path';

/** Workflow types accepted by the API (excludes the internal 'unknown'). */
export const VALID_WORKFLOWS = [
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
] as const;

export class SecurityUtils {
  /**
   * Validate and normalize file paths to prevent directory traversal attacks.
   * Ensures the resolved path stays within the allowed base directory.
   */
  static validatePath(basePath: string, userPath: string): string {
    if (!userPath || typeof userPath !== 'string') {
      throw new Error('Invalid path: path must be a non-empty string');
    }

    const resolved = path.resolve(basePath, userPath);
    const normalized = path.normalize(resolved);

    if (!normalized.startsWith(basePath)) {
      throw new Error('Path traversal detected: path must be within project directory');
    }

    return normalized;
  }

  /**
   * Sanitize input strings to prevent injection attacks.
   * Removes potentially dangerous characters while preserving valid path characters.
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .replace(/[<>"|?*]/g, '') // Remove shell metacharacters
      .slice(0, 1024); // Limit length
  }

  /**
   * Validate file path format (no null bytes, no excessive length).
   */
  static isValidFilePath(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    if (filePath.length > 4096) {
      return false;
    }

    if (filePath.includes('\0')) {
      return false;
    }

    return true;
  }

  /**
   * Check if a string is a valid workflow type.
   */
  static isValidWorkflow(workflow: string): boolean {
    return (VALID_WORKFLOWS as readonly string[]).includes(workflow);
  }

  /**
   * Rate limit key generator for IP-based rate limiting.
   * Extract client IP from request (handling proxies).
   */
  static getClientIp(req: any): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Validate request body size to prevent DoS attacks.
   */
  static validateBodySize(contentLength: number | undefined, maxBytes: number = 52428800): boolean {
    if (!contentLength) {
      return true;
    }
    return contentLength <= maxBytes;
  }
}
