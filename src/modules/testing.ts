/**
 * Testing & QA module
 * - Run devtools::test()
 * - Run devtools::check()
 * - Validate roxygen2 documentation
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class TestingModule {
  async runTests(args: { package_path: string; filter?: string }) {
    try {
      const filterArg = args.filter
        ? `, filter = '${args.filter.replace(/'/g, "\\'")}'`
        : "";
      const { stdout, stderr } = await execAsync(
        `cd '${args.package_path.replace(/'/g, "\\'")}' && Rscript -e "
          devtools::load_all('.')
          results <- devtools::test(stop_on_failure = FALSE${filterArg})
          cat('\\n=== TEST SUMMARY ===\\n')
          cat('Total tests:', nrow(results), '\\n')
          cat('Passed:', sum(results\$result == 'P'), '\\n')
          cat('Failed:', sum(results\$result == 'F'), '\\n')
          cat('Skipped:', sum(results\$result == 'S'), '\\n')
          if (any(results\$result != 'P')) {
            cat('\\n=== FAILURES ===\\n')
            failed <- results[results\$result != 'P', ]
            print(failed)
          }
        "`,
        { maxBuffer: 10 * 1024 * 1024 }
      );
      return {
        content: [{ type: "text", text: stdout || stderr }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to run tests: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async runCheck(args: { package_path: string; args?: string }) {
    try {
      const checkArgs = args.args ? `, args = '${args.args.replace(/'/g, "\\'")}'` : "";
      const { stdout, stderr } = await execAsync(
        `cd '${args.package_path.replace(/'/g, "\\'")}' && Rscript -e "
          devtools::check(error_on = 'never'${checkArgs})
        "`,
        { maxBuffer: 10 * 1024 * 1024 }
      );
      return {
        content: [{ type: "text", text: stdout || stderr }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to run check: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async validateRoxygen(args: { package_path: string }) {
    try {
      const { stdout, stderr } = await execAsync(
        `cd '${args.package_path.replace(/'/g, "\\'")}' && Rscript -e "
          # Check if roxygen comments are valid
          files <- list.files('R', pattern = '\\\\.R\$', full.names = TRUE)
          if (length(files) == 0) {
            cat('No R files found\\n')
          } else {
            cat('Validating roxygen2 documentation...\\n')
            tryCatch({
              roxygen2::roxygenise(load_code = sourceDir)
              cat('\\nRoxygen2 validation successful!\\n')
              cat('Run devtools::document() to update docs\\n')
            }, error = function(e) {
              cat('Roxygen2 validation failed:', e\$message, '\\n')
            })
          }
        "`,
        { maxBuffer: 5 * 1024 * 1024 }
      );
      return {
        content: [{ type: "text", text: stdout || stderr }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to validate roxygen: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
