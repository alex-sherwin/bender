import { Parser, Language, Node, Tree } from 'web-tree-sitter';

import type { Location } from './types';

/**
 * Initialize web-tree-sitter.
 * Must be called before creating any parsers.
 * @author GitHub Copilot
 */
export async function initTreeSitter(): Promise<void> {
  await Parser.init();
}

/**
 * Load a specific tree-sitter language parser.
 * @param language The language name (e.g., 'java', 'typescript')
 * @param wasmPath Path to the WASM file
 * @returns The loaded Language instance
 * @author GitHub Copilot
 */
export async function loadParser(language: string, wasmPath: string): Promise<Language> {
  const lang = await Language.load(wasmPath);
  return lang;
}

/**
 * Walk the AST and call the visitor function on each node.
 * @param node The root node to start walking from
 * @param visitor Function called for each node
 * @author GitHub Copilot
 */
export function walkAST(node: Node, visitor: (node: Node) => void): void {
  visitor(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      walkAST(child, visitor);
    }
  }
}

/**
 * Get the text content of a node.
 * @param node The node
 * @returns The text content
 * @author GitHub Copilot
 */
export function getNodeText(node: Node): string {
  return node.text;
}

/**
 * Get the location (line and column) of a node.
 * @param node The node
 * @returns Location object with start and end positions
 * @author GitHub Copilot
 */
export function getLocation(node: Node): Location {
  return {
    start: { line: node.startPosition.row, column: node.startPosition.column },
    end: { line: node.endPosition.row, column: node.endPosition.column },
  };
}

/**
 * Build a qualified name from parts.
 * @param parts Array of name parts
 * @returns Qualified name joined by dots
 * @author GitHub Copilot
 */
export function buildQualifiedName(parts: string[]): string {
  return parts.filter(p => p.length > 0).join('.');
}

/**
 * Find the first node of a specific type.
 * @param target The root node or tree to search from
 * @param type The node type to find
 * @returns The first matching node or null
 */
export function findFirstNodeOfType(target: Node | Tree | null | undefined, type: string): Node | null {
  if (!target) return null;
  const node = target instanceof Tree ? target.rootNode : target;
  if (node.type === type) return node;
  return node.descendantsOfType(type)[0] ?? null;
}

/**
 * Find the last node of a specific type.
 * @param target The root node or tree to search from
 * @param type The node type to find
 * @returns The last matching node or null
 */
export function findLastNodeOfType(target: Node | Tree | null | undefined, type: string): Node | null {
  if (!target) return null;
  const node = target instanceof Tree ? target.rootNode : target;
  if (node.type === type) return node;
  const results = node.descendantsOfType(type);
  return results.at(-1) ?? null;
}

/**
 * Get block comment preceding a node.
 * @param node The node to check
 * @returns The comment text or null
 */
export function getBlockComment(node: Node): string | null {
  const parent = node.parent;
  if (!parent) return null;

  const nodeIndex = (node as any).index ?? 0;
  if (nodeIndex === 0) return null;

  const previousNode = parent.child(nodeIndex - 1);
  if (previousNode && (previousNode.type === "comment" || previousNode.type === "block_comment")) {
    return previousNode.text;
  }

  return null;
}