import { Database } from "bun:sqlite";
import { initDatabase } from "../db/schema";
import { log } from "../logger";
import {
  listSnapshots,
  compareSnapshots,
  deleteSnapshot,
  setLatestSnapshot,
  getSnapshotStats,
} from "../db/snapshots";
import { parseSnapshotCommandArgs } from "./args-parser";

/**
 * CLI command for snapshot management
 * Usage: snapshots [--db <database-path>] <subcommand> [args...]
 * @author GitHub Copilot
 */
export async function snapshotCommand(args: string[]): Promise<void> {
  try {
    const parsed = parseSnapshotCommandArgs(args);

    // Extract positional arguments (subcommand and its args)
    const positionalArgs: string[] = [];
    for (const arg of args) {
      if (!arg.startsWith('--')) {
        positionalArgs.push(arg);
      } else {
        // Skip flag and its value
        const nextIdx = args.indexOf(arg) + 1;
        if (nextIdx < args.length && !args[nextIdx].startsWith('--')) {
          // Skip the value too
        }
      }
    }

    if (positionalArgs.length < 1) {
      log.error('Usage: snapshots [--db <database-path>] <subcommand> [args...]');
      log.error('Subcommands:');
      log.error('  list - Show all snapshots');
      log.error('  compare <id1> <id2> - Diff two snapshots');
      log.error('  delete <id> - Remove snapshot');
      log.error('  set-latest <id> - Change latest snapshot');
      log.error('  stats [id] - Show stats for snapshot (default: latest)');
      log.error('Options:');
      log.error('  --db <path> - Database file path (default: index.db)');
      process.exit(1);
    }

    const subcommand = positionalArgs[0];
    const subArgs = positionalArgs.slice(1);

    try {
      const db = initDatabase(parsed.db);

      switch (subcommand) {
        case 'list':
          await handleListSnapshots(db);
          break;
        case 'compare':
          await handleCompareSnapshots(db, subArgs);
          break;
        case 'delete':
          await handleDeleteSnapshot(db, subArgs);
          break;
        case 'set-latest':
          await handleSetLatestSnapshot(db, subArgs);
          break;
        case 'stats':
          await handleSnapshotStats(db, subArgs);
          break;
        default:
          log.error(`Unknown subcommand: ${subcommand}`);
          process.exit(1);
      }

      db.close();
    } catch (error) {
      log.error('Snapshot command failed:', error);
      process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Parse error:', message);
    log.error('Usage: snapshots [--db <database-path>] <subcommand> [args...]');
    process.exit(1);
  }
}

async function handleListSnapshots(db: Database): Promise<void> {
  const snapshots = listSnapshots(db);

  if (snapshots.length === 0) {
    log.info('No snapshots found');
    return;
  }

  console.log('Snapshots:');
  console.log('ID | Created At | Latest | Description | Symbols');
  console.log('---|------------|--------|-------------|---------');

  for (const snapshot of snapshots) {
    const latest = snapshot.is_latest ? 'Yes' : 'No';
    const desc = snapshot.description ?? '';
    console.log(`${snapshot.id.slice(0, 8)} | ${new Date(snapshot.created_at).toLocaleString()} | ${latest} | ${desc} | ${snapshot.symbolCount}`);
  }
}

async function handleCompareSnapshots(db: Database, args: string[]): Promise<void> {
  if (args.length < 2) {
    log.error('Usage: snapshots compare <id1> <id2>');
    process.exit(1);
  }

  const snapshot1 = args[0];
  const snapshot2 = args[1];

  const comparison = compareSnapshots(db, snapshot1, snapshot2);

  console.log(`Comparing snapshots ${snapshot1.slice(0, 8)} -> ${snapshot2.slice(0, 8)}:`);
  console.log('');

  console.log(`Added symbols (${comparison.addedSymbols.length}):`);
  for (const symbol of comparison.addedSymbols.slice(0, 10)) {
    console.log(`  + ${symbol.qualified_name} (${symbol.kind})`);
  }
  if (comparison.addedSymbols.length > 10) {
    console.log(`  ... and ${comparison.addedSymbols.length - 10} more`);
  }

  console.log('');
  console.log(`Removed symbols (${comparison.removedSymbols.length}):`);
  for (const symbol of comparison.removedSymbols.slice(0, 10)) {
    console.log(`  - ${symbol.qualified_name} (${symbol.kind})`);
  }
  if (comparison.removedSymbols.length > 10) {
    console.log(`  ... and ${comparison.removedSymbols.length - 10} more`);
  }

  console.log('');
  console.log(`Modified symbols (${comparison.modifiedSymbols.length}):`);
  for (const mod of comparison.modifiedSymbols.slice(0, 10)) {
    console.log(`  ~ ${mod.new.qualified_name} (${mod.new.kind})`);
  }
  if (comparison.modifiedSymbols.length > 10) {
    console.log(`  ... and ${comparison.modifiedSymbols.length - 10} more`);
  }
}

async function handleDeleteSnapshot(db: Database, args: string[]): Promise<void> {
  if (args.length < 1) {
    log.error('Usage: snapshots delete <id>');
    process.exit(1);
  }

  const snapshotId = args[0];

  deleteSnapshot(db, snapshotId);
  console.log(`Snapshot ${snapshotId} deleted successfully`);
}

async function handleSetLatestSnapshot(db: Database, args: string[]): Promise<void> {
  if (args.length < 1) {
    log.error('Usage: snapshots set-latest <id>');
    process.exit(1);
  }

  const snapshotId = args[0];

  setLatestSnapshot(db, snapshotId);
  console.log(`Snapshot ${snapshotId} set as latest`);
}

async function handleSnapshotStats(db: Database, args: string[]): Promise<void> {
  let snapshotId = args[0];

  if (!snapshotId) {
    // Get latest snapshot
    const stmt = db.prepare("SELECT id FROM snapshots WHERE is_latest = 1 LIMIT 1");
    const result = stmt.get() as { id: string } | undefined;
    if (!result) {
      log.error('No snapshots found');
      process.exit(1);
    }
    snapshotId = result.id;
  }

  const stats = getSnapshotStats(db, snapshotId);

  console.log(`Statistics for snapshot ${snapshotId.slice(0, 8)}:`);
  console.log(`Files: ${stats.fileCount}`);
  console.log(`Symbols: ${stats.symbolCount}`);
  console.log(`References: ${stats.referenceCount}`);
}