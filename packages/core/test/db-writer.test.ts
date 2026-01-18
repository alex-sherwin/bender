import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from "bun:sqlite";


import { writeParsedFile } from '../src/db/writer';
import { initDatabase, createSnapshot } from '../src/db/schema';
import type { ParsedFileData } from '../src/db/types';

describe('Database Writer', () => {
  let db: Database;

  beforeEach(() => {
    db = initDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('writes ParsedFileData to database', () => {
    const snapshotId = createSnapshot(db, 'test-snapshot-1');

    const parsedData: ParsedFileData = {
      file: {
        path: 'com/example/Calculator.java',
        language: 'java',
        package: 'com.example',
      },
      symbols: [
        {
          kind: 'class',
          name: 'Calculator',
          qualified_name: 'com.example.Calculator',
          signature: 'public class Calculator',
          metadata: { visibility: 'public' },
        },
        {
          kind: 'method',
          name: 'add',
          qualified_name: 'com.example.Calculator.add',
          signature: 'public int add(int a, int b)',
          parent: 'com.example.Calculator',
          metadata: { visibility: 'public', returnType: 'int' },
        },
        {
          kind: 'field',
          name: 'value',
          qualified_name: 'com.example.Calculator.value',
          signature: 'private int value',
          parent: 'com.example.Calculator',
          metadata: { visibility: 'private', type: 'int' },
        },
      ],
      references: [
        {
          from_qualified_name: 'com.example.Calculator.add',
          to_qualified_name: 'com.example.Calculator.value',
          ref_kind: 'field_access',
        },
      ],
       imports: [
         {
           source_package: 'java.util.List',
           wildcard: false,
           imported_names: ['List'],
         },
       ],
    };

    writeParsedFile(db, snapshotId, parsedData);

    // Verify file was inserted
    const files = db.prepare('SELECT * FROM files WHERE snapshot_id = ?').all(snapshotId) as Array<{ id: number; path: string; language: string; package: string | null }>;
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('com/example/Calculator.java');
    expect(files[0].language).toBe('java');
    expect(files[0].package).toBe('com.example');

    // Verify symbols were inserted
    const symbols = db.prepare('SELECT * FROM symbols WHERE snapshot_id = ? ORDER BY qualified_name').all(snapshotId) as Array<{ id: number; parent_id: number | null; kind: string; name: string; qualified_name: string }>;
    expect(symbols).toHaveLength(3);

    // Check class symbol
    const classSymbol = symbols.find(s => s.kind === 'class');
    expect(classSymbol).toBeDefined();
    expect(classSymbol!.name).toBe('Calculator');
    expect(classSymbol!.qualified_name).toBe('com.example.Calculator');
    expect(classSymbol!.parent_id).toBeNull();

    // Check method symbol has correct parent
    const methodSymbol = symbols.find(s => s.kind === 'method');
    expect(methodSymbol).toBeDefined();
    expect(methodSymbol!.name).toBe('add');
    expect(methodSymbol!.parent_id).toBe(classSymbol!.id);

    // Check field symbol has correct parent
    const fieldSymbol = symbols.find(s => s.kind === 'field');
    expect(fieldSymbol).toBeDefined();
    expect(fieldSymbol!.name).toBe('value');
    expect(fieldSymbol!.parent_id).toBe(classSymbol!.id);

    // Verify references were inserted
    const references = db.prepare('SELECT * FROM "references" WHERE snapshot_id = ?').all(snapshotId) as Array<{ id: number; from_symbol_id: number; to_qualified_name: string; ref_kind: string }>;
    expect(references).toHaveLength(1);
    expect(references[0].from_symbol_id).toBe(methodSymbol!.id);
    expect(references[0].to_qualified_name).toBe('com.example.Calculator.value');
    expect(references[0].ref_kind).toBe('field_access');

     // Verify imports were inserted
     const imports = db.prepare('SELECT * FROM imports WHERE snapshot_id = ?').all(snapshotId) as Array<{ id: number; source_package: string; wildcard: number; imported_names: string }>;
     expect(imports).toHaveLength(1);
     expect(imports[0].source_package).toBe('java.util.List');
     expect(imports[0].wildcard).toBe(0);
     expect(JSON.parse(imports[0].imported_names)).toEqual(['List']);
  });

  it('handles symbols without parents', () => {
    const snapshotId = createSnapshot(db, 'test-snapshot-2');

    const parsedData: ParsedFileData = {
      file: {
        path: 'utils.ts',
        language: 'typescript',
      },
      symbols: [
        {
          kind: 'function',
          name: 'formatDate',
          qualified_name: 'utils.ts:formatDate',
          signature: 'export function formatDate(date: Date): string',
        },
        {
          kind: 'variable',
          name: 'PI',
          qualified_name: 'utils.ts:PI',
          signature: 'export const PI = 3.14',
        },
      ],
      references: [],
      imports: [],
    };

    writeParsedFile(db, snapshotId, parsedData);

    const symbols = db.prepare('SELECT * FROM symbols WHERE snapshot_id = ? ORDER BY name').all(snapshotId) as Array<{ id: number; parent_id: number | null; name: string }>;
    expect(symbols).toHaveLength(2);
    expect(symbols.every(s => s.parent_id === null)).toBe(true);
  });

  it('resolves internal references to symbol IDs', () => {
    const snapshotId = createSnapshot(db, 'test-snapshot-3');

    const parsedData: ParsedFileData = {
      file: {
        path: 'com/example/Service.java',
        language: 'java',
        package: 'com.example',
      },
      symbols: [
        {
          kind: 'class',
          name: 'Service',
          qualified_name: 'com.example.Service',
          signature: 'public class Service',
        },
        {
          kind: 'method',
          name: 'helper',
          qualified_name: 'com.example.Service.helper',
          signature: 'private void helper()',
          parent: 'com.example.Service',
        },
        {
          kind: 'method',
          name: 'process',
          qualified_name: 'com.example.Service.process',
          signature: 'public void process()',
          parent: 'com.example.Service',
        },
      ],
      references: [
        {
          from_qualified_name: 'com.example.Service.process',
          to_qualified_name: 'com.example.Service.helper',
          ref_kind: 'call',
        },
        {
          from_qualified_name: 'com.example.Service.process',
          to_qualified_name: 'java.util.List', // external reference
          ref_kind: 'type_reference',
        },
      ],
      imports: [],
    };

    writeParsedFile(db, snapshotId, parsedData);

    const references = db.prepare('SELECT * FROM "references" WHERE snapshot_id = ? ORDER BY to_qualified_name').all(snapshotId) as Array<{ id: number; from_symbol_id: number; to_qualified_name: string; to_symbol_id: number | null; ref_kind: string }>;
    expect(references).toHaveLength(2);

    // Internal reference should have to_symbol_id set
    const internalRef = references.find(r => r.to_qualified_name === 'com.example.Service.helper');
    expect(internalRef).toBeDefined();
    expect(internalRef!.to_symbol_id).not.toBeNull();

    // External reference should have to_symbol_id as null
    const externalRef = references.find(r => r.to_qualified_name === 'java.util.List');
    expect(externalRef).toBeDefined();
    expect(externalRef!.to_symbol_id).toBeNull();
  });

  it('handles metadata serialization', () => {
    const snapshotId = createSnapshot(db, 'test-snapshot-4');

    const parsedData: ParsedFileData = {
      file: {
        path: 'test.ts',
        language: 'typescript',
      },
      symbols: [
        {
          kind: 'function',
          name: 'test',
          qualified_name: 'test.ts:test',
          signature: 'function test(a: string, b: number): boolean',
          metadata: {
            parameters: [
              { name: 'a', type: 'string' },
              { name: 'b', type: 'number' },
            ],
            returnType: 'boolean',
            async: false,
          },
        },
      ],
      references: [],
      imports: [],
    };

    writeParsedFile(db, snapshotId, parsedData);

    const symbols = db.prepare('SELECT * FROM symbols WHERE snapshot_id = ?').all(snapshotId) as Array<{ id: number; metadata: string }>;
    expect(symbols).toHaveLength(1);

    const metadata = JSON.parse(symbols[0].metadata);
    expect(metadata.parameters).toHaveLength(2);
    expect(metadata.returnType).toBe('boolean');
    expect(metadata.async).toBe(false);
  });
});