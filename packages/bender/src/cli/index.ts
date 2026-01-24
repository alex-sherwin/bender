#!/usr/bin/env bun
/**
 * Commander.js CLI entry point for bender
 * @author GitHub Copilot
 */

import { Command } from "commander";
import { handleIndexCommand } from "./index-cmd";
import { handleQueryCommand } from "./query-cmd";
import { log } from "../logger";

/**
 * Main CLI program
 * @author GitHub Copilot
 */
async function main(): Promise<void> {
  const program = new Command();

  program
    .name("bender")
    .version("0.0.1")
    .description("Multi-language code indexer and query tool")
    .option("-v, --verbose", "Enable verbose logging");

  // Index command
  program
    .command("index")
    .description("Index a source directory and create a snapshot")
    .argument("<source-dir>", "Source directory to index")
    .argument("<db-path>", "Path to SQLite database file")
    .option("-n, --name <name>", "Snapshot name (default: git branch name or 'default')")
    .option("-d, --description <desc>", "Snapshot description")
    .option("--replace", "Replace existing snapshot with same name")
    .option("--verbose", "Verbose logging")
    .action(async (sourceDir: string, dbPath: string, options: Record<string, unknown>) => {
      try {
        const verbose = Boolean(options.verbose ?? program.opts().verbose);
        await handleIndexCommand(sourceDir, dbPath, {
          name: options.name as string | undefined,
          description: options.description as string | undefined,
          replace: Boolean(options.replace),
          verbose,
        });
        process.exit(0);
      } catch (error) {
        if (error instanceof Error) {
          log.error("Index command failed:", error);
        }
        process.exit(1);
      }
    });

  // Query command
  program
    .command("query")
    .description("Query indexed symbols by pattern")
    .argument("<pattern>", "Regular expression pattern to match symbols")
    .argument("<db-path>", "Path to SQLite database file")
    .option("--format <yaml|json>", "Output format (default: yaml)", "yaml")
    .option("--sources", "Include source code snippets")
    .option("--radius <N>", "Include symbols within N relationship hops", parseInt)
    .option("--comments", "Include associated comments")
    .option("--type <type>", "Filter by symbol type (class|method|field|variable|parameter)")
    .option("--snapshot <name>", "Query specific snapshot (default: latest)")
    .option("--context <N>", "Source context lines (default: 3)", parseInt)
    .option("--source-dir <dir>", "Source directory (required for --sources flag)")
    .option("--verbose", "Verbose logging")
    .action(async (pattern: string, dbPath: string, options: Record<string, unknown>) => {
      try {
        const verbose = Boolean(options.verbose ?? program.opts().verbose);
        await handleQueryCommand(pattern, dbPath, {
          format: options.format as "yaml" | "json" | undefined,
          sources: Boolean(options.sources),
          radius: options.radius as number | undefined,
          comments: Boolean(options.comments),
          type: options.type as "class" | "method" | "field" | "variable" | "parameter" | undefined,
          snapshot: options.snapshot as string | undefined,
          context: options.context as number | undefined,
          sourceDir: options.sourceDir as string | undefined,
          verbose,
        });
        process.exit(0);
      } catch (error) {
        if (error instanceof Error) {
          log.error("Query command failed:", error);
        }
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  log.error("Fatal error:", error);
  process.exit(1);
});
