/**
 * CRAN integration module
 * - Search packages
 * - Get package metadata
 * - Check dependencies
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class CranModule {
  async search(args: { query: string; limit?: number }) {
    const limit = args.limit || 10;
    try {
      const { stdout } = await execAsync(
        `Rscript -e "
          pkgs <- available.packages()
          query <- '${args.query.replace(/'/g, "\\'")}'
          matches <- which(
            grepl(query, pkgs[,'Package'], ignore.case=TRUE) |
            grepl(query, pkgs[,'Title'], ignore.case=TRUE) |
            grepl(query, pkgs[,'Description'], ignore.case=TRUE)
          )
          result <- data.frame(
            Package = pkgs[matches, 'Package'],
            Version = pkgs[matches, 'Version'],
            Title = pkgs[matches, 'Title']
          )
          result <- result[1:min(nrow(result), ${limit}), ]
          cat(jsonlite::toJSON(result, pretty=TRUE))
        "`
      );
      return {
        content: [{ type: "text", text: stdout }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to search CRAN: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getPackageInfo(args: { package: string }) {
    try {
      const { stdout } = await execAsync(
        `Rscript -e "
          pkg <- '${args.package.replace(/'/g, "\\'")}'
          tryCatch({
            meta <- available.packages()[pkg, ]
            if (is.na(meta['Package'])) {
              cat(jsonlite::toJSON(list(error = paste('Package', pkg, 'not found on CRAN'))))
            } else {
              info <- list(
                Package = meta['Package'],
                Version = meta['Version'],
                Title = meta['Title'],
                Author = meta['Author'],
                Maintainer = meta['Maintainer'],
                License = meta['License'],
                Description = meta['Description'],
                URL = meta['URL']
              )
              cat(jsonlite::toJSON(info, pretty=TRUE))
            }
          }, error = function(e) {
            cat(jsonlite::toJSON(list(error = e\$message)))
          })
        "`
      );
      return {
        content: [{ type: "text", text: stdout }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to get package info: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async checkDependencies(args: { description_path: string }) {
    try {
      const { stdout } = await execAsync(
        `Rscript -e "
          desc_file <- '${args.description_path.replace(/'/g, "\\'")}'
          if (!file.exists(desc_file)) {
            cat(jsonlite::toJSON(list(error = 'DESCRIPTION file not found')))
          } else {
            desc <- read.dcf(desc_file)
            deps <- desc[1, c('Depends', 'Imports', 'Suggests')]

            result <- list(
              Depends = if (!is.na(deps['Depends'])) strsplit(deps['Depends'], ',')[[1]] else character(),
              Imports = if (!is.na(deps['Imports'])) strsplit(deps['Imports'], ',')[[1]] else character(),
              Suggests = if (!is.na(deps['Suggests'])) strsplit(deps['Suggests'], ',')[[1]] else character()
            )

            # Clean whitespace and versions
            result <- lapply(result, function(x) {
              trimws(gsub('\\\\(.*\\\\)', '', x))
            })

            cat(jsonlite::toJSON(result, pretty=TRUE))
          }
        "`
      );
      return {
        content: [{ type: "text", text: stdout }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to check dependencies: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
