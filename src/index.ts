import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { CranModule } from "./modules/cran.js";
import { TestingModule } from "./modules/testing.js";
import { ReleaseModule } from "./modules/release.js";

const server = new Server({
  name: "r-coding-mcp",
  version: "0.1.0",
});

// Initialize modules
const cran = new CranModule();
const testing = new TestingModule();
const release = new ReleaseModule();

// Register tools
const tools: Tool[] = [
  // CRAN tools
  {
    name: "cran_search",
    description: "Search CRAN for R packages by keyword",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query (package name or keywords)",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "cran_package_info",
    description: "Get detailed information about a CRAN package",
    inputSchema: {
      type: "object" as const,
      properties: {
        package: {
          type: "string",
          description: "Package name",
        },
      },
      required: ["package"],
    },
  },
  {
    name: "cran_check_dependencies",
    description: "Check package dependencies against CRAN",
    inputSchema: {
      type: "object" as const,
      properties: {
        description_path: {
          type: "string",
          description: "Path to DESCRIPTION file",
        },
      },
      required: ["description_path"],
    },
  },

  // Testing tools
  {
    name: "devtools_test",
    description: "Run devtools::test() on an R package",
    inputSchema: {
      type: "object" as const,
      properties: {
        package_path: {
          type: "string",
          description: "Path to package root directory",
        },
        filter: {
          type: "string",
          description: "Optional filter pattern for test files",
        },
      },
      required: ["package_path"],
    },
  },
  {
    name: "devtools_check",
    description: "Run devtools::check() on an R package",
    inputSchema: {
      type: "object" as const,
      properties: {
        package_path: {
          type: "string",
          description: "Path to package root directory",
        },
        args: {
          type: "string",
          description: "Additional R CMD CHECK arguments",
        },
      },
      required: ["package_path"],
    },
  },
  {
    name: "roxygen_validate",
    description: "Validate roxygen2 documentation",
    inputSchema: {
      type: "object" as const,
      properties: {
        package_path: {
          type: "string",
          description: "Path to package root directory",
        },
      },
      required: ["package_path"],
    },
  },

  // Release tools
  {
    name: "bump_version",
    description: "Bump package version (major/minor/patch)",
    inputSchema: {
      type: "object" as const,
      properties: {
        package_path: {
          type: "string",
          description: "Path to package root directory",
        },
        type: {
          type: "string",
          enum: ["major", "minor", "patch"],
          description: "Version bump type",
        },
      },
      required: ["package_path", "type"],
    },
  },
  {
    name: "prepare_release",
    description: "Prepare package for CRAN release",
    inputSchema: {
      type: "object" as const,
      properties: {
        package_path: {
          type: "string",
          description: "Path to package root directory",
        },
        version: {
          type: "string",
          description: "Target version",
        },
      },
      required: ["package_path", "version"],
    },
  },
  {
    name: "generate_news",
    description: "Generate NEWS/CHANGELOG from git commits",
    inputSchema: {
      type: "object" as const,
      properties: {
        package_path: {
          type: "string",
          description: "Path to package root directory",
        },
        since_tag: {
          type: "string",
          description: "Generate changes since this tag",
        },
      },
      required: ["package_path"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request;

  try {
    switch (name) {
      // CRAN tools
      case "cran_search":
        return await cran.search(args as any);
      case "cran_package_info":
        return await cran.getPackageInfo(args as any);
      case "cran_check_dependencies":
        return await cran.checkDependencies(args as any);

      // Testing tools
      case "devtools_test":
        return await testing.runTests(args as any);
      case "devtools_check":
        return await testing.runCheck(args as any);
      case "roxygen_validate":
        return await testing.validateRoxygen(args as any);

      // Release tools
      case "bump_version":
        return await release.bumpVersion(args as any);
      case "prepare_release":
        return await release.prepareRelease(args as any);
      case "generate_news":
        return await release.generateNews(args as any);

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("r-coding-mcp server running on stdio");
}

main().catch(console.error);
