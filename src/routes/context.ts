import type { RuntimeConfig } from '../config/runtime.js';
import type { WorkflowDetector } from '../engine/detector.js';
import type { Validator } from '../engine/validator.js';
import type { TemplateGenerator } from '../engine/template-generator.js';
import type { RateLimiter } from '../utils/rate-limiter.js';

/** What the route modules share; built once by the web server. */
export interface RouteContext {
  runtime: RuntimeConfig;
  env: NodeJS.ProcessEnv;
  detector: WorkflowDetector;
  validator: Validator;
  templateGenerator: TemplateGenerator;
  rateLimiter: RateLimiter;
  /** Absolute paths of served files, resolved once next to the server entry point. */
  paths: {
    publicDir: string;
    browserEngineDir: string;
    swaggerDistDir: string;
  };
}
