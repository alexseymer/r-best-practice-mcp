/**
 * Release automation module
 * - Bump versions
 * - Prepare releases
 * - Generate NEWS/CHANGELOG
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

export class ReleaseModule {
  async bumpVersion(args: { package_path: string; type: "major" | "minor" | "patch" }) {
    try {
      const descPath = path.join(args.package_path, "DESCRIPTION");

      if (!fs.existsSync(descPath)) {
        return {
          content: [
            { type: "text", text: "DESCRIPTION file not found" },
          ],
          isError: true,
        };
      }

      const { stdout } = await execAsync(
        `Rscript -e "
          desc_file <- '${descPath.replace(/'/g, "\\'")}'
          desc <- read.dcf(desc_file)
          current <- desc[1, 'Version']

          # Parse version
          parts <- as.numeric(strsplit(current, '\\\\.')[[1]])

          # Bump based on type
          type <- '${args.type}'
          if (type == 'major') {
            parts[1] <- parts[1] + 1
            parts[2] <- 0
            parts[3] <- 0
          } else if (type == 'minor') {
            parts[2] <- parts[2] + 1
            parts[3] <- 0
          } else if (type == 'patch') {
            parts[3] <- parts[3] + 1
          }

          new_version <- paste(parts, collapse = '.')
          desc[1, 'Version'] <- new_version
          write.dcf(desc, file = desc_file)

          cat('Version bumped:', current, '->', new_version, '\\n')
          cat(new_version)
        "`
      );

      return {
        content: [
          {
            type: "text",
            text: `Version bumped successfully\n${stdout}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to bump version: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async prepareRelease(args: { package_path: string; version: string }) {
    try {
      const { stdout, stderr } = await execAsync(
        `cd '${args.package_path.replace(/'/g, "\\'")}' && Rscript -e "
          cat('=== RELEASE CHECKLIST ===\\n')
          cat('\\n1. Updating DESCRIPTION...\\n')

          # Update version
          desc_file <- 'DESCRIPTION'
          desc <- read.dcf(desc_file)
          desc[1, 'Version'] <- '${args.version.replace(/'/g, "\\'")}'
          desc[1, 'Date'] <- as.character(Sys.Date())
          write.dcf(desc, file = desc_file)
          cat('   ✓ Version set to ${args.version}\\n')

          cat('\\n2. Running package check...\\n')
          tryCatch({
            check_result <- devtools::check(error_on = 'note', document = TRUE)
            cat('   ✓ Package check passed\\n')
          }, error = function(e) {
            cat('   ⚠ Package check failed:', e\$message, '\\n')
          })

          cat('\\n3. Preparing for CRAN submission...\\n')
          cat('   - Check NEWS.md is up-to-date\\n')
          cat('   - Verify README.md\\n')
          cat('   - Run: devtools::submit_cran()\\n')
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
            text: `Failed to prepare release: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async generateNews(args: { package_path: string; since_tag?: string }) {
    try {
      const sinceTag = args.since_tag || "HEAD~10..HEAD";
      const { stdout } = await execAsync(
        `cd '${args.package_path.replace(/'/g, "\\'")}' && git log ${sinceTag} --oneline --pretty=format:"%h - %s (%an, %ar)" 2>/dev/null || echo "No git history available"`
      );

      const commits = stdout
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => `* ${line}`);

      const newsContent = `# News

## Version ${args.package_path}

${commits.join("\n")}

---
Generated: ${new Date().toISOString()}
`;

      return {
        content: [
          {
            type: "text",
            text: `Generated changelog:\n\n${newsContent}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to generate news: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
