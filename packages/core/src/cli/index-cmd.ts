import { readdir, readFile } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { Database } from 'bun:sqlite';

import { indexDirectory } from '../indexer';
import { log } from '../logger';

/**
 * CLI command for indexing a directory
 * Usage: index <source-dir> <output-db> [description]
 * @author GitHub Copilot
 */
export async function indexCommand(args: string[]): Promise<void> {
  if (args.length < 2) {
    log.error('Usage: index <source-directory> <output-db-path> [snapshot-description]');
    process.exit(1);
  }

  const [sourceDir, dbPath, ...descParts] = args;
  const description = descParts.join(' ') || undefined;

  try {
    await indexDirectory(sourceDir, dbPath, description);
  } catch (error) {
    log.error('Indexing failed:', error);
    process.exit(1);
  }
}