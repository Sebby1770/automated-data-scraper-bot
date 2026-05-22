#!/usr/bin/env node
import "dotenv/config";
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, resolveConfigPath } from "./config.js";
import { logSummary, runOnce, watch } from "./runner.js";

const command = process.argv[2] ?? "run";
const configPath = readFlag("--config") ?? process.env.CONFIG_PATH;

try {
  if (command === "init") {
    initConfig();
  } else if (command === "validate") {
    const resolved = resolveConfigPath(configPath);
    loadConfig(resolved);
    console.log(`Config is valid: ${resolved}`);
  } else if (command === "watch") {
    const config = loadConfig(configPath);
    await watch(config);
  } else if (command === "run") {
    const config = loadConfig(configPath);
    const summary = await runOnce(config, {
      dryRun: process.argv.includes("--dry-run")
    });
    logSummary(summary);
  } else {
    printHelp();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function readFlag(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function initConfig(): void {
  const destination = resolve(process.cwd(), "config.yml");
  if (existsSync(destination)) {
    console.log("config.yml already exists.");
    return;
  }

  copyFileSync(resolve(process.cwd(), "config.example.yml"), destination);
  console.log("Created config.yml from config.example.yml.");
}

function printHelp(): void {
  console.log(`Usage:
  data-scraper-bot run [--config config.yml] [--dry-run]
  data-scraper-bot watch [--config config.yml]
  data-scraper-bot validate [--config config.yml]
  data-scraper-bot init`);
}
