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
    console.error('Commands:');
    console.error('  index <source-dir> <output-db> [description] - Index a directory');
    console.error('  query <subcommand> [args...] - Query the index');
    console.error('  snapshots <subcommand> [args...] - Manage snapshots');
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