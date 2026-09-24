import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { WikiplaneService } from "@wikiplane/application";

const TOOLS = [
  {
    name: "wikiplane_status",
    description: "Return compact status for the configured Wikiplane brain.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "wikiplane_ingest",
    description:
      "Ingest a URL or local source through the complete Wikiplane transaction.",
    inputSchema: {
      type: "object",
      properties: { source: { type: "string" } },
      required: ["source"],
      additionalProperties: false,
    },
  },
  {
    name: "wikiplane_query",
    description:
      "Query the compiled gold wiki without returning raw source bodies.",
    inputSchema: {
      type: "object",
      properties: { question: { type: "string" } },
      required: ["question"],
      additionalProperties: false,
    },
  },
  {
    name: "wikiplane_lint",
    description: "Validate schema, links, provenance, and derived state.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "wikiplane_rebuild",
    description: "Deterministically rebuild wiki navigation without an LLM.",
    inputSchema: {
      type: "object",
      properties: { check: { type: "boolean" } },
      additionalProperties: false,
    },
  },
  {
    name: "wikiplane_remove_source",
    description:
      "Remove a source and only the knowledge that is no longer supported.",
    inputSchema: {
      type: "object",
      properties: { source_id: { type: "string" } },
      required: ["source_id"],
      additionalProperties: false,
    },
  },
  {
    name: "wikiplane_recompile",
    description:
      "Recompile wiki knowledge from durable raw Markdown in an isolated Git transaction.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
] as const;

export function createWikiplaneMcpServer(service: WikiplaneService): Server {
  const server = new Server(
    { name: "wikiplane", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...TOOLS],
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    try {
      let result: unknown;
      switch (request.params.name) {
        case "wikiplane_status":
          result = await service.status();
          break;
        case "wikiplane_ingest":
          result = await service.ingest(requireString(args, "source"));
          break;
        case "wikiplane_query":
          result = await service.query(requireString(args, "question"));
          break;
        case "wikiplane_lint":
          result = await service.lint();
          break;
        case "wikiplane_rebuild":
          result = await service.rebuild(args.check === true);
          break;
        case "wikiplane_remove_source":
          result = await service.removeSource(requireString(args, "source_id"));
          break;
        case "wikiplane_recompile":
          result = await service.recompile();
          break;
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ status: "error", error: message }),
          },
        ],
        isError: true,
      };
    }
  });
  return server;
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${key} is required`);
  return value;
}
