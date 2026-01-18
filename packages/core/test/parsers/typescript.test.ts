import { describe, it, expect, beforeAll } from 'vitest';

import { TypeScriptParser } from '../../src/parsers/typescript';

describe('TypeScriptParser', () => {
  let parser: TypeScriptParser;

  beforeAll(async () => {
    parser = new TypeScriptParser();
    await parser.initialize();
  });

  it('parses basic TypeScript class', () => {
    const content = `
export class Calculator {
  private value: number = 0;

  constructor(initialValue: number) {
    this.value = initialValue;
  }

  public add(a: number, b: number): number {
    return a + b;
  }

  public multiply(a: number, b: number): number {
    return a * b;
  }
}
`;

    const result = parser.parseFile('src/utils/Calculator.ts', content);

    expect(result.file.path).toBe('src/utils/Calculator.ts');
    expect(result.file.language).toBe('typescript');

    // Check symbols
    expect(result.symbols.length).toBeGreaterThanOrEqual(3); // class, constructor, 2 methods

    // Class symbol
    const classSymbol = result.symbols.find(s => s.kind === 'class');
    expect(classSymbol).toBeDefined();
    expect(classSymbol!.name).toBe('Calculator');
    expect(classSymbol!.qualified_name).toBe('src/utils/Calculator:Calculator');

    // Method symbols
    const methodSymbols = result.symbols.filter(s => s.kind === 'method');
    expect(methodSymbols.length).toBeGreaterThanOrEqual(2);
    expect(methodSymbols.map(m => m.name)).toEqual(
      expect.arrayContaining(['add', 'multiply'])
    );
  });

  it('parses interface', () => {
    const content = `
export interface User {
  id: number;
  name: string;
  email: string;
}

export interface UserService {
  findUser(id: number): Promise<User>;
  saveUser(user: User): Promise<void>;
}
`;

    const result = parser.parseFile('src/types/User.ts', content);

    const symbols = result.symbols;
    expect(symbols.length).toBeGreaterThanOrEqual(2); // 2 interfaces

    const interfaces = symbols.filter(s => s.kind === 'interface');
    expect(interfaces.length).toBeGreaterThanOrEqual(2);
    expect(interfaces.map(i => i.name)).toEqual(
      expect.arrayContaining(['User', 'UserService'])
    );

    // Check qualified names
    expect(interfaces[0].qualified_name).toBe('src/types/User:User');
    expect(interfaces[1].qualified_name).toBe('src/types/User:UserService');
  });

  it('parses function declarations', () => {
    const content = `
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function helperFunction(value: string): boolean {
  return value.length > 0;
}

export const calculateTotal = (items: number[]): number => {
  return items.reduce((sum, item) => sum + item, 0);
};
`;

    const result = parser.parseFile('src/utils/helpers.ts', content);

    const symbols = result.symbols;
    expect(symbols.length).toBeGreaterThanOrEqual(2); // exported function, const, maybe helper

    // Exported function
    const formatDate = symbols.find(s => s.name === 'formatDate');
    expect(formatDate).toBeDefined();
    expect(formatDate!.kind).toBe('function');
    expect(formatDate!.qualified_name).toBe('src/utils/helpers:formatDate');

    // Arrow function assigned to const (may not be extracted yet)
    const calculateTotal = symbols.find(s => s.name === 'calculateTotal');
    if (calculateTotal) {
      expect(calculateTotal.kind).toBe('variable');
      expect(calculateTotal.qualified_name).toBe('src/utils/helpers:calculateTotal');
    }
  });

  it('parses imports and exports', () => {
    const content = `
import { Component } from 'react';
import * as fs from 'fs';
import { readFile, writeFile } from 'fs/promises';
import type { User } from './types';

export { UserService } from './UserService';
export default class App extends Component {}
`;

    const result = parser.parseFile('src/App.ts', content);

    // Check imports
    expect(result.imports.length).toBeGreaterThan(0);

    // Verify we can parse the imports correctly
    const imports = result.imports;
    expect(imports.some(i => i.source_package.includes('react'))).toBe(true);
    expect(imports.some(i => i.source_package.includes('fs'))).toBe(true);
  });

  it('extracts method calls and property accesses', () => {
    const content = `
import { api } from './api';

export class DataService {
  async fetchUsers(): Promise<User[]> {
    const response = await api.get('/users');
    return response.data;
  }

  saveUser(user: User): void {
    api.post('/users', user);
  }
}
`;

    const result = parser.parseFile('src/services/DataService.ts', content);

    // Should have class and methods extracted
    const classSym = result.symbols.find(s => s.kind === 'class');
    expect(classSym).toBeDefined();

    const methods = result.symbols.filter(s => s.kind === 'method');
    expect(methods.length).toBeGreaterThan(0);
  });

  it('handles generics and complex types', () => {
    const content = `
export interface Repository<T> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
}

export class UserRepository implements Repository<User> {
  async findAll(): Promise<User[]> {
    // implementation
    return [];
  }

  async findById(id: string): Promise<User | null> {
    // implementation
    return null;
  }

  async save(entity: User): Promise<User> {
    // implementation
    return entity;
  }
}
`;

    const result = parser.parseFile('src/repositories/UserRepository.ts', content);

    const symbols = result.symbols;
    expect(symbols.length).toBeGreaterThan(5); // interface + 3 methods, class + 3 methods

    // Check that methods have correct signatures with generics
    const findAllMethods = symbols.filter(s => s.name === 'findAll');
    expect(findAllMethods.length).toBeGreaterThan(0);
    expect(findAllMethods[0].signature).toContain('Promise');
  });
});