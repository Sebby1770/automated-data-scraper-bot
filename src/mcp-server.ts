#!/usr/bin/env node
import "dotenv/config";
import { createInterface } from "node:readline";
import { loadConfig } from "./config.js";
import { getHealthResponse } from "./api.js";
import { runOnce } from "./runner.js";
import { createMemoryPriceHistoryStore } from "./state/price-history.js";
import { MemoryStateStore } from "./state/memory.js";

const SERVER_NAME = "automated-data-scraper-bot";
const SERVER_VERSION = "0.4.0";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const tools = [
  {
    name: "run_scrape",
    description: "Run a single scrape pass using the configured sources and rules.",
    inputSchema: {
      type: "object",
      properties: {
        dryRun: { type: "boolean", description: "When true, evaluate rules without sending notifications." },
        configPath: { type: "string", description: "Optional path to config YAML." }
      }
    }
  },
  {
    name: "list_sources",
    description: "List configured data sources from the bot config.",
    inputSchema: {
      type: "object",
      properties: {
        configPath: { type: "string", description: "Optional path to config YAML." }
      }
    }
  },
  {
    name: "list_rules",
    description: "List configured alert rules from the bot config.",
    inputSchema: {
      type: "object",
      properties: {
        configPath: { type: "string", description: "Optional path to config YAML." }
      }
    }
  },
  {
    name: "get_health",
    description: "Return scraper bot version and process uptime.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
] as const;

function writeMessage(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function respond(id: string | number | null, result: unknown): void {
  writeMessage({
    jsonrpc: "2.0",
    id,
    result
  } satisfies JsonRpcResponse);
}

function respondError(id: string | number | null, code: number, message: string, data?: unknown): void {
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: { code, message, data }
  } satisfies JsonRpcResponse);
}

async function handleRequest(request: JsonRpcRequest): Promise<void> {
  const id = request.id ?? null;

  if (request.method === "initialize") {
    respond(id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: SERVER_NAME,
        version: SERVER_VERSION
      }
    });
    return;
  }

  if (request.method === "notifications/initialized") {
    return;
  }

  if (request.method === "tools/list") {
    respond(id, { tools });
    return;
  }

  if (request.method === "tools/call") {
    const toolName = String(request.params?.name ?? "");
    const args = (request.params?.arguments ?? {}) as Record<string, unknown>;

    try {
      const content = await executeTool(toolName, args);
      respond(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(content, null, 2)
          }
        ],
        isError: false
      });
    } catch (error) {
      respond(id, {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error)
          }
        ],
        isError: true
      });
    }
    return;
  }

  if (request.id !== undefined && request.id !== null) {
    respondError(id, -32601, `Method not found: ${request.method ?? "unknown"}`);
  }
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const configPath = typeof args.configPath === "string" ? args.configPath : process.env.CONFIG_PATH;

  switch (name) {
    case "get_health":
      return getHealthResponse().data;

    case "list_sources": {
      const config = loadConfig(configPath);
      return config.sources.map((source) => ({
        id: source.id,
        type: source.type,
        label: source.label ?? source.id
      }));
    }

    case "list_rules": {
      const config = loadConfig(configPath);
      return config.rules.map((rule) => ({
        name: rule.name,
        source: rule.source,
        all: rule.all ?? [],
        any: rule.any ?? []
      }));
    }

    case "run_scrape": {
      const config = loadConfig(configPath);
      const dryRun = args.dryRun !== false;
      return runOnce(config, {
        dryRun,
        includeAlerts: true,
        stateStore: new MemoryStateStore(),
        priceHistoryStore: createMemoryPriceHistoryStore()
      });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const readline = createInterface({
  input: process.stdin,
  terminal: false
});

readline.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  void (async () => {
    try {
      const request = JSON.parse(trimmed) as JsonRpcRequest;
      await handleRequest(request);
    } catch (error) {
      respondError(null, -32700, "Parse error", error instanceof Error ? error.message : String(error));
    }
  })();
});

process.stderr.write(`[mcp] ${SERVER_NAME} v${SERVER_VERSION} ready on stdio\n`);