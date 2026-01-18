#!/usr/bin/env tsx

import { indexCommand } from './cli/index-cmd';
import { queryCommand } from './cli/query-cmd';
import { snapshotCommand } from './cli/snapshot-cmd';

/**
 * Main CLI entry point
 * Usage: bender <command> [args...]
 * @author GitHub Copilot
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: bender <command> [args...]');
    console.error('');
    console.error('Commands:');
    console.error('  index <source-dir> <output-db> [description]');
    console.error('    Index a directory with optional language filtering');
    console.error('    Flags: --typescript --bash --java --csharp --tsx --all-langs');
    console.error('    Examples:');
    console.error('      bender index ./src ./db.sqlite --typescript');
    console.error('      bender index ./src ./db.sqlite --typescript --bash');
    console.error('');
    console.error('  query <subcommand> [args...]');
    console.error('    Query the indexed database');
    console.error('    Subcommands: blast-radius, find-usages, list-symbols, search');
    console.error('');
    console.error('  snapshots <subcommand> [args...]');
    console.error('    Manage snapshots');
    console.error('    Subcommands: list, compare, delete, set-latest, stats');
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