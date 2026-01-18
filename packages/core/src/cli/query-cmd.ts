import { Database } from "bun:sqlite";
import { initDatabase } from "../db/schema";
import { log } from "../logger";
import {
  getLatestSnapshot,
  findReferences,
  getBlastRadius,
  getFileSymbols,
  searchSymbols,
} from "../db/queries";

/**
 * CLI command for querying the index
 * Usage: query <subcommand> [args...]
 * @author GitHub Copilot
 */
export async function queryCommand(args: string[]): Promise<void> {
  if (args.length < 1) {
    log.error('Usage: query <subcommand> [args...]');
    log.error('Subcommands:');
    log.error('  blast-radius <qualified-name> [depth] - Show call graph');
    log.error('  find-usages <qualified-name> - Show all references');
    log.error('  list-symbols [file-path] - List symbols (optionally filtered by file)');
    log.error('  search <pattern> - Search symbols by pattern');
    log.error('Options:');
    log.error('  --snapshot <id> - Use specific snapshot (default: latest)');
    process.exit(1);
  }

  const subcommand = args[0];
  const subArgs = args.slice(1);

  // Parse --snapshot option
  let snapshotId: string | null = null;
  const snapshotIndex = subArgs.indexOf('--snapshot');
  if (snapshotIndex !== -1) {
    if (snapshotIndex + 1 >= subArgs.length) {
      log.error('--snapshot requires an ID argument');
      process.exit(1);
    }
    snapshotId = subArgs[snapshotIndex + 1];
    subArgs.splice(snapshotIndex, 2);
  }

  // Default database path (TODO: make configurable)
  const dbPath = 'index.db';

  try {
    const db = initDatabase(dbPath);

    // Get snapshot ID if not provided
    if (!snapshotId) {
      snapshotId = getLatestSnapshot(db);
      if (!snapshotId) {
        log.error('No snapshots found in database');
        process.exit(1);
      }
    }

    switch (subcommand) {
      case 'blast-radius':
        await handleBlastRadius(db, snapshotId, subArgs);
        break;
      case 'find-usages':
        await handleFindUsages(db, snapshotId, subArgs);
        break;
      case 'list-symbols':
        await handleListSymbols(db, snapshotId, subArgs);
        break;
      case 'search':
        await handleSearch(db, snapshotId, subArgs);
        break;
      default:
        log.error(`Unknown subcommand: ${subcommand}`);
        process.exit(1);
    }

    db.close();
  } catch (error) {
    log.error('Query failed:', error);
    process.exit(1);
  }
}

async function handleBlastRadius(db: Database, snapshotId: string, args: string[]): Promise<void> {
  if (args.length < 1) {
    log.error('Usage: query blast-radius <qualified-name> [depth]');
    process.exit(1);
  }

  const qualifiedName = args[0];
  const depth = args[1] ? parseInt(args[1], 10) : 3;

  if (isNaN(depth) || depth < 1) {
    log.error('Depth must be a positive integer');
    process.exit(1);
  }

  const results = getBlastRadius(db, snapshotId, qualifiedName, depth);

  if (results.length === 0) {
    log.info(`No blast radius found for ${qualifiedName}`);
    return;
  }

  console.log(`Blast radius for ${qualifiedName} (depth ${depth}):`);
  console.log('Depth | Kind | Qualified Name | File');
  console.log('------|------|----------------|-----');

  for (const result of results) {
    console.log(`${result.depth.toString().padEnd(5)} | ${result.kind.padEnd(4)} | ${result.qualified_name.padEnd(14)} | ${result.file_path}`);
  }
}

async function handleFindUsages(db: Database, snapshotId: string, args: string[]): Promise<void> {
  if (args.length < 1) {
    log.error('Usage: query find-usages <qualified-name>');
    process.exit(1);
  }

  const qualifiedName = args[0];
  const results = findReferences(db, snapshotId, qualifiedName);

  if (results.length === 0) {
    log.info(`No usages found for ${qualifiedName}`);
    return;
  }

  console.log(`Usages of ${qualifiedName}:`);
  console.log('File | Line | Kind | Context');
  console.log('-----|------|------|--------');

  for (const result of results) {
    console.log(`${result.file_path} | ${result.line} | ${result.ref_kind} | ${result.context || ''}`);
  }
}

async function handleListSymbols(db: Database, snapshotId: string, args: string[]): Promise<void> {
  const filePath = args[0] || null;

  const results = filePath ? getFileSymbols(db, snapshotId, filePath) : [];

  if (filePath && results.length === 0) {
    log.info(`No symbols found in file ${filePath}`);
    return;
  }

  // TODO: If no file specified, list all symbols in snapshot (need to implement)
  if (!filePath) {
    log.error('Listing all symbols not yet implemented. Please specify a file path.');
    process.exit(1);
  }

  console.log(`Symbols in ${filePath}:`);
  console.log('Qualified Name | Kind | Name | Signature');
  console.log('---------------|------|------|----------');

  for (const result of results) {
    console.log(`${result.qualified_name} | ${result.kind} | ${result.name} | ${result.signature}`);
  }
}

async function handleSearch(db: Database, snapshotId: string, args: string[]): Promise<void> {
  if (args.length < 1) {
    log.error('Usage: query search <pattern>');
    process.exit(1);
  }

  const pattern = args[0];
  const results = searchSymbols(db, snapshotId, pattern);

  if (results.length === 0) {
    log.info(`No symbols found matching ${pattern}`);
    return;
  }

  console.log(`Symbols matching ${pattern}:`);
  console.log('ID | Qualified Name | Kind | File');
  console.log('---|---------------|------|-----');

  for (const result of results) {
    console.log(`${result.id} | ${result.qualified_name} | ${result.kind} | ${result.file_path}`);
  }
}