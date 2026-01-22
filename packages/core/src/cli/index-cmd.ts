import { indexDirectory } from '../indexer';
import { log } from '../logger';
import { parseIndexCommandArgs } from './args-parser';

/**
 * CLI command for indexing a directory
 * Usage: index --path <source-dir> --db <output-db> [--description <text>] [language-flags]
 * @author GitHub Copilot
 */
export async function indexCommand(args: string[]): Promise<void> {
  try {
    const parsed = parseIndexCommandArgs(args);
    await indexDirectory(
      parsed.path,
      parsed.db,
      parsed.description,
      parsed.languages
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Parse error:', message);
    log.error('Usage: index --path <source-directory> --db <output-db-path> [--description <text>]');
    log.error('Flags: --typescript --bash --java --csharp --tsx --all-langs');
    log.error('Example: index --path ./src --db ./db.sqlite --typescript');
    process.exit(1);
  }
}