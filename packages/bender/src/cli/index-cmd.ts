/**
 * Index command handler
 * @author GitHub Copilot
 */

import fs from "node:fs/promises";
import path from "node:path";
import { indexDirectory } from "../indexer";
import { log } from "../logger";

/**
 * Options for the index command
 * @author GitHub Copilot
 */
export interface IndexCommandOptions {
  name?: string;
  description?: string;
  replace?: boolean;
  verbose?: boolean;
}

/**
 * Validate that a path is writable
 * @author GitHub Copilot
 * @param filePath Path to check
 * @returns True if writable or doesn't exist
 */
async function isWritablePath(filePath: string): Promise<boolean> {
  try {
    const dirPath = path.dirname(filePath);
    await fs.access(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Handle the index command
 * @author GitHub Copilot
 * @param sourceDir Source directory to index
 * @param dbPath Path to database file
 * @param options Command options
 */
export async function handleIndexCommand(
  sourceDir: string,
  dbPath: string,
  options: IndexCommandOptions
): Promise<void> {
  const { name, description, replace = false, verbose = false } = options;

  // Validate source directory exists and is a directory
  try {
    const stats = await fs.stat(sourceDir);
    if (!stats.isDirectory()) {
      throw new Error(`Source path is not a directory: ${sourceDir}`);
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`Source directory does not exist: ${sourceDir}`);
    }
    throw error;
  }

  // Validate db-path is writable location
  const isWritable = await isWritablePath(dbPath);
  if (!isWritable) {
    throw new Error(`Database path is not writable: ${dbPath}`);
  }

  // Display start message
  if (verbose) {
    log.info(`Indexing directory: ${sourceDir}`);
    log.info(`Database: ${dbPath}`);
    if (name) log.info(`Snapshot name: ${name}`);
    if (description) log.info(`Description: ${description}`);
    if (replace) log.info("Replace mode: enabled");
  }

  // Call indexDirectory
  const result = await indexDirectory(sourceDir, dbPath, {
    snapshotName: name,
    description,
    replace,
    verbose,
  });

  // Report statistics
  console.log(`\n✓ Indexing complete`);
  console.log(`  Files indexed: ${result.filesIndexed}`);
  console.log(`  Symbols found: ${result.symbolsFound}`);
  console.log(`  Snapshot ID: ${result.snapshotId}`);
}
