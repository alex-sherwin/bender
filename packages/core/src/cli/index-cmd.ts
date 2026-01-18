import { indexDirectory } from '../indexer';
import { log } from '../logger';
import { parseIndexCommandArgs } from './args-parser';

/**
 * CLI command for indexing a directory
 * Usage: index <source-dir> <output-db> [description] [language-flags]
 * @author GitHub Copilot
 */
export async function indexCommand(args: string[]): Promise<void> {
  try {
    const parsed = parseIndexCommandArgs(args);
    await indexDirectory(
      parsed.sourceDir,
      parsed.outputDb,
      parsed.description,
      parsed.languages
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Parse error:', message);
    log.error('Usage: index <source-directory> <output-db-path> [snapshot-description]');
    log.error('Flags: --typescript --bash --java --csharp --tsx --all-langs');
    log.error('Example: index ./src ./db.sqlite --typescript');
    process.exit(1);
  }
}