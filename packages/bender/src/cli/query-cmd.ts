/**
 * Query command handler
 * @author GitHub Copilot
 */

import fs from "node:fs/promises";
import { initializeDatabase } from "../db/schema";
import { getLatestSnapshot, getSnapshotByName } from "../db/snapshots";
import { findSymbolsByPattern } from "../db/queries";
import { buildQueryOutput, formatOutput } from "../output/formatter";
import type { OutputOptions } from "../output/types";
import { log } from "../logger";

/**
 * Options for the query command
 * @author GitHub Copilot
 */
export interface QueryCommandOptions {
  format?: "yaml" | "json";
  sources?: boolean;
  radius?: number;
  comments?: boolean;
  type?: "class" | "method" | "field" | "variable" | "parameter";
  snapshot?: string;
  context?: number;
  sourceDir?: string;
  verbose?: boolean;
}

/**
 * Handle the query command
 * @author GitHub Copilot
 * @param pattern Regular expression pattern
 * @param dbPath Path to database file
 * @param options Command options
 */
export async function handleQueryCommand(
  pattern: string,
  dbPath: string,
  options: QueryCommandOptions
): Promise<void> {
  const {
    format = "yaml",
    sources = false,
    radius,
    comments = false,
    type,
    snapshot: snapshotName,
    context = 3,
    sourceDir,
    verbose = false,
  } = options;

  // Validate db-path exists
  try {
    await fs.stat(dbPath);
  } catch {
    throw new Error(`Database file does not exist: ${dbPath}`);
  }

  // Validate --source-dir if --sources flag used
  if (sources && !sourceDir) {
    throw new Error("--source-dir is required when --sources flag is used");
  }

  if (sources && sourceDir) {
    try {
      const stats = await fs.stat(sourceDir);
      if (!stats.isDirectory()) {
        throw new Error(`Source directory path is not a directory: ${sourceDir}`);
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new Error(`Source directory does not exist: ${sourceDir}`);
      }
      throw error;
    }
  }

  // Validate regex pattern
  try {
    new RegExp(pattern);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid regular expression pattern: ${error.message}`);
    }
    throw new Error("Invalid regular expression pattern");
  }

  // Validate format
  if (format !== "yaml" && format !== "json") {
    throw new Error(`Invalid format: ${format}. Must be 'yaml' or 'json'`);
  }

  // Open database
  const db = initializeDatabase(dbPath);

  // Get snapshot (by name or latest)
  const snapshot = snapshotName
    ? getSnapshotByName(db, snapshotName)
    : getLatestSnapshot(db);

  if (!snapshot) {
    if (snapshotName) {
      throw new Error(`Snapshot not found: ${snapshotName}`);
    } else {
      throw new Error("No snapshots found in database");
    }
  }

  if (verbose) {
    log.info(`Using snapshot: ${snapshot.name} (ID: ${snapshot.id})`);
    log.info(`Pattern: ${pattern}`);
    if (type) log.info(`Type filter: ${type}`);
  }

  // Call findSymbolsByPattern
  const symbols = findSymbolsByPattern(db, pattern, {
    type,
    snapshotId: snapshot.id,
  });

  if (symbols.length === 0) {
    console.log("No symbols found");
    return;
  }

  if (verbose) {
    log.info(`Found ${symbols.length} matching symbols`);
  }

  // Build output options from flags
  const outputOptions: OutputOptions = {
    includeOccurrences: true, // Always include occurrences for context
    includeRelationships: radius !== undefined,
    radius,
    includeDocumentation: comments,
    includeSources: sources,
    contextLines: context,
  };

  // Call buildQueryOutput with enrichment options
  const queryOutput = await buildQueryOutput(
    db,
    sourceDir ?? "",
    symbols,
    outputOptions
  );

  // Format and print results
  const formatted = formatOutput(queryOutput.symbols, format);
  console.log(formatted);
}
