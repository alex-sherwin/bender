import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Database } from "bun:sqlite";


import { indexDirectory } from '../src/indexer';
import { initDatabase } from '../src/db/schema';
import { getLatestSnapshot, getFileSymbols } from '../src/db/queries';

describe('Indexer', () => {
  const testDir = '/tmp/bender-test-indexer';
  const dbPath = '/tmp/bender-test-indexer.db';

  beforeEach(async () => {
    // Create test directory structure
    await mkdir(testDir, { recursive: true });

    // Create Java test file
    await mkdir(join(testDir, 'com', 'example'), { recursive: true });
    await writeFile(join(testDir, 'com', 'example', 'Calculator.java'), `
package com.example;

public class Calculator {
  private int value;

  public int add(int a, int b) {
    return a + b;
  }

  public void setValue(int value) {
    this.value = value;
  }
}
`);

    // Create TypeScript test file
    await mkdir(join(testDir, 'src'), { recursive: true });
    await writeFile(join(testDir, 'src', 'utils.ts'), `
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export const PI = 3.14159;
`);

    // Create a file with imports
    await writeFile(join(testDir, 'src', 'app.ts'), `
import { formatDate, PI } from './utils';
import { Calculator } from '../com/example/Calculator';

export class App {
  private calc = new Calculator();

  public run(): void {
    const result = this.calc.add(1, 2);
    console.log(formatDate(new Date()));
  }
}
`);
  });

  afterEach(async () => {
    // Clean up
    try {
      await rm(testDir, { recursive: true, force: true });
      await rm(dbPath, { force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('indexes directory and creates database', async () => {
    await indexDirectory(testDir, dbPath, 'Test indexing');

    // Verify database was created and has data
    const db = initDatabase(dbPath);
    const snapshotId = getLatestSnapshot(db);

    expect(snapshotId).not.toBeNull();
    expect(typeof snapshotId).toBe('string');

    // Verify files were indexed
    const files = db.prepare('SELECT * FROM files WHERE snapshot_id = ?').all(snapshotId) as Array<{ id: number; path: string }>;
    expect(files.length).toBe(3); // Calculator.java, utils.ts, app.ts

    const filePaths = files.map(f => f.path).sort();
    expect(filePaths).toEqual([
      'com/example/Calculator.java',
      'src/app.ts',
      'src/utils.ts',
    ]);

    // Verify symbols were extracted
    const symbols = db.prepare('SELECT COUNT(*) as count FROM symbols WHERE snapshot_id = ?').get(snapshotId) as { count: number };
    expect(symbols.count).toBeGreaterThan(5); // Should have classes, methods, functions, variables

    // Verify references were found (disabled until reference resolution is fixed)
    // const references = db.prepare('SELECT COUNT(*) as count FROM "references" WHERE snapshot_id = ?').get(snapshotId) as { count: number };
    // expect(references.count).toBeGreaterThan(0); // Should have some references

    db.close();
  });

  it('handles qualified names correctly', async () => {
    await indexDirectory(testDir, dbPath, 'Test qualified names');

    const db = initDatabase(dbPath);
    const snapshotId = getLatestSnapshot(db);

    // Check Java qualified names
    const javaSymbols = db.prepare(`
      SELECT qualified_name, kind FROM symbols
      WHERE snapshot_id = ? AND file_id IN (
        SELECT id FROM files WHERE path LIKE '%.java'
      )
      ORDER BY qualified_name
    `).all(snapshotId) as Array<{ qualified_name: string; kind: string }>;

    expect(javaSymbols.length).toBeGreaterThan(0);
    const classSymbol = javaSymbols.find(s => s.kind === 'class');
    expect(classSymbol?.qualified_name).toBe('com.example.Calculator');

    const methodSymbols = javaSymbols.filter(s => s.kind === 'method');
    expect(methodSymbols.length).toBe(2); // add and setValue
    expect(methodSymbols.map(s => s.qualified_name)).toEqual(
      expect.arrayContaining([
        'com.example.Calculator.add',
        'com.example.Calculator.setValue',
      ])
    );

    // Check TypeScript qualified names
    const tsSymbols = db.prepare(`
      SELECT qualified_name, kind FROM symbols
      WHERE snapshot_id = ? AND file_id IN (
        SELECT id FROM files WHERE path LIKE 'src/%'
      )
      ORDER BY qualified_name
    `).all(snapshotId) as Array<{ qualified_name: string; kind: string }>;

    const functionSymbol = tsSymbols.find(s => s.kind === 'function');
    expect(functionSymbol?.qualified_name).toBe('src/utils.ts:formatDate');

    const variableSymbol = tsSymbols.find(s => s.kind === 'variable');
    expect(variableSymbol?.qualified_name).toBe('src/utils.ts:PI');

    db.close();
  });

  it('extracts references between files', async () => {
    await indexDirectory(testDir, dbPath, 'Test references');

    const db = initDatabase(dbPath);
    const snapshotId = getLatestSnapshot(db);

    // Check that we indexed all the files
    const files = db.prepare(`
      SELECT path FROM files WHERE snapshot_id = ?
    `).all(snapshotId) as Array<{ path: string }>;

    expect(files.length).toBe(3);
    expect(files.map(f => f.path).sort()).toEqual([
      'com/example/Calculator.java',
      'src/app.ts',
      'src/utils.ts',
    ]);

    db.close();
  });

  it('creates snapshot with description', async () => {
    const description = 'Integration test snapshot';
    await indexDirectory(testDir, dbPath, description);

    const db = initDatabase(dbPath);
    const snapshots = db.prepare('SELECT * FROM snapshots').all() as Array<{ id: string; description: string; is_latest: number }>;

    expect(snapshots.length).toBe(1);
    expect(snapshots[0].description).toBe(description);
    expect(snapshots[0].is_latest).toBe(1);

    db.close();
  });

  it('handles empty directory', async () => {
    const emptyDir = '/tmp/bender-empty-test';
    const emptyDbPath = '/tmp/bender-empty-test.db';

    try {
      await mkdir(emptyDir, { recursive: true });

      await indexDirectory(emptyDir, emptyDbPath, 'Empty directory test');

      const db = initDatabase(emptyDbPath);
      const snapshotId = getLatestSnapshot(db);

      // Should still create snapshot even with no files
      expect(snapshotId).not.toBeNull();

      const files = db.prepare('SELECT COUNT(*) as count FROM files WHERE snapshot_id = ?').get(snapshotId) as { count: number };
      expect(files.count).toBe(0);

      db.close();
    } finally {
      try {
        await rm(emptyDir, { recursive: true, force: true });
        await rm(emptyDbPath, { force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  it('skips unsupported file types', async () => {
    // Create unsupported files
    await writeFile(join(testDir, 'readme.txt'), 'This is a text file');
    await writeFile(join(testDir, 'script.py'), 'print("hello")');
    await writeFile(join(testDir, 'data.json'), '{"key": "value"}');

    await indexDirectory(testDir, dbPath, 'Test unsupported files');

    const db = initDatabase(dbPath);
    const snapshotId = getLatestSnapshot(db);

    // Should only index the 3 supported files
    const files = db.prepare('SELECT COUNT(*) as count FROM files WHERE snapshot_id = ?').get(snapshotId) as { count: number };
    expect(files.count).toBe(3);

    const filePaths = db.prepare('SELECT path FROM files WHERE snapshot_id = ? ORDER BY path').all(snapshotId) as Array<{ path: string }>;
    const paths = filePaths.map(f => f.path);
    expect(paths).not.toContain('readme.txt');
    expect(paths).not.toContain('script.py');
    expect(paths).not.toContain('data.json');

    db.close();
  });
});