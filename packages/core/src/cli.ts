#!/usr/bin/env tsx

import { indexCommand } from './cli/index-cmd';
import { queryCommand } from './cli/query-cmd';
import { snapshotCommand } from './cli/snapshot-cmd';

/**
 * Main CLI entry point
 * Usage: bender <command> [flags...]
 * @author GitHub Copilot
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: bender <command> [flags...]');
    console.error('');
    console.error('Commands:');
    console.error('  index - Index a directory');
    console.error('    Required flags:');
    console.error('      --path <directory> - Directory to scan');
    console.error('      --db <path> - Output database path');
    console.error('    Optional flags:');
    console.error('      --description <text> - Snapshot description');
    console.error('      --typescript --bash --java --csharp --tsx --all-langs - Language filters');
    console.error('    Example: bender index --path ./src --db ./db.sqlite --typescript');
    console.error('');
    console.error('  query - Query the indexed database');
    console.error('    Optional flags:');
    console.error('      --db <path> - Database path (default: index.db)');
    console.error('      --snapshot <id> - Use specific snapshot (default: latest)');
    console.error('    Subcommands:');
    console.error('      blast-radius <name> [depth] - Show call graph');
    console.error('      find-usages <name> - Show all references');
    console.error('      list-symbols [file] - List symbols');
    console.error('      search <pattern> - Search symbols');
    console.error('    Example: bender query --db ./db.sqlite blast-radius "MyClass.method"');
    console.error('');
    console.error('  snapshots - Manage snapshots');
    console.error('    Optional flags:');
    console.error('      --db <path> - Database path (default: index.db)');
    console.error('    Subcommands:');
    console.error('      list - Show all snapshots');
    console.error('      compare <id1> <id2> - Diff two snapshots');
    console.error('      delete <id> - Remove snapshot');
    console.error('      set-latest <id> - Change latest snapshot');
    console.error('      stats [id] - Show stats for snapshot');
    console.error('    Example: bender snapshots --db ./db.sqlite list');
    process.exit(1);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'index':
        await indexCommand(commandArgs);
        break;
      case 'query':
        await queryCommand(commandArgs);
        break;
      case 'snapshots':
        await snapshotCommand(commandArgs);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Command failed:', error);
    process.exit(1);
  }
}

main();