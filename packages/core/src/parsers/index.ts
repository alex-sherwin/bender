import { extname } from 'node:path';

import type { LanguageParser } from './types';
import { JavaParser } from './java';
import { TypeScriptParser } from './typescript';

// Parser registry: maps file extensions to parser instances
const parserRegistry = new Map<string, LanguageParser>();

// Initialize parsers
const javaParser = new JavaParser();
const typeScriptParser = new TypeScriptParser();

// Initialize parsers asynchronously
let initialized = false;
async function initializeParsers(): Promise<void> {
  if (initialized) return;

  await Promise.all([
    javaParser.initialize(),
    typeScriptParser.initialize(),
  ]);

  // Register parsers
  registerParser('.java', javaParser);
  registerParser('.ts', typeScriptParser);
  registerParser('.tsx', typeScriptParser); // TypeScript parser handles both .ts and .tsx

  initialized = true;
}

/**
 * Register a parser for a specific file extension.
 * @param extension File extension including the dot (e.g., '.java')
 * @param parser The parser instance
 * @author GitHub Copilot
 */
export function registerParser(extension: string, parser: LanguageParser): void {
  parserRegistry.set(extension, parser);
}

/**
 * Get the appropriate parser for a file based on its extension.
 * @param filePath Path to the file
 * @returns The parser instance or null if no parser is registered for the extension
 * @author GitHub Copilot
 */
export async function getParserForFile(filePath: string): Promise<LanguageParser | null> {
  await initializeParsers();
  const ext = extname(filePath).toLowerCase();
  return parserRegistry.get(ext) ?? null;
}

/**
 * Detect the language from a file extension.
 * @param filePath Path to the file
 * @returns The language name or null if unknown
 * @author GitHub Copilot
 */
export function detectLanguage(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case '.java':
      return 'java';
    case '.ts':
      return 'typescript';
    case '.tsx':
      return 'tsx';
    case '.cs':
      return 'csharp';
    case '.sh':
      return 'bash';
    default:
      return null;
  }
}