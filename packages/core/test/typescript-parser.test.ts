import { describe, it, expect } from 'vitest';

import { 
  getInterfaces, 
  getInterface,
  getInterfaceMembers,
  getTypes, 
  getType,
  getClasses, 
  getClass,
  getFunctions, 
  getFunction,
  getFunctionParameters,
  createTypeScriptParser,
  getImports,
  getClassMethods,
  getClassProperties
} from "../src/typescript-parser";
import type { TypeScriptInterface, TypeScriptType, TypeScriptClass, TypeScriptFunction } from '../src/types';


describe('typescript-parser', () => {

  // Interface Tests
  it('getInterfaces: single interface', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
interface User {
  id: number;
  name: string;
}
`)!;

    const interfaces = getInterfaces(tree);

    expect(interfaces).toHaveLength(1);
    expect(interfaces[0].name).toEqual("User");
  });

  it('getInterfaces: interface with multiple members', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
interface Product {
  id: number;
  name: string;
  price: number;
  inStock: boolean;
}
`)!;

    const interfaces = getInterfaces(tree);

    expect(interfaces).toHaveLength(1);
    expect(interfaces[0].name).toEqual("Product");
    expect(interfaces[0].members).toHaveLength(4);
  });

  it('getInterfaceMembers: extracts member names and types', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
interface Config {
  host: string;
  port: number;
  timeout?: number;
}
`)!;

    const interfaces = getInterfaces(tree);
    const members = interfaces[0].members;

    expect(members).toHaveLength(3);
    expect(members[0].name).toEqual("host");
    expect(members[0].type).toContain("string");
    expect(members[1].name).toEqual("port");
    expect(members[1].type).toContain("number");
    expect(members[2].name).toEqual("timeout");
    expect(members[2].optional).toBe(true);
  });

  it('getInterfaceMembers: interface with methods', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
interface Handler {
  id: string;
  process(data: string): void;
  validate(): boolean;
}
`)!;

    const interfaces = getInterfaces(tree);

    expect(interfaces).toHaveLength(1);
    expect(interfaces[0].members.length).toBeGreaterThan(0);
  });

  // Type Alias Tests
  it('getTypes: single type alias', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
type Status = "active" | "inactive" | "pending";
`)!;

    const types = getTypes(tree);

    expect(types).toHaveLength(1);
    expect(types[0].name).toEqual("Status");
  });

  it('getTypes: object type alias', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
type Person = {
  firstName: string;
  lastName: string;
  age: number;
};
`)!;

    const types = getTypes(tree);

    expect(types).toHaveLength(1);
    expect(types[0].name).toEqual("Person");
    expect(types[0].members.length).toBeGreaterThan(0);
  });

  it('getTypes: multiple type aliases', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
type Id = string | number;
type Callback = (result: boolean) => void;
type Config = { timeout: number; retries: number };
`)!;

    const types = getTypes(tree);

    expect(types).toHaveLength(3);
    expect(types[0].name).toEqual("Id");
    expect(types[1].name).toEqual("Callback");
    expect(types[2].name).toEqual("Config");
  });

  // Class Tests
  it('getClasses: single class', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
class User {
  id: number;
  name: string;

  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }

  getName(): string {
    return this.name;
  }
}
`)!;

    const classes = getClasses(tree);

    expect(classes).toHaveLength(1);
    expect(classes[0].name).toEqual("User");
  });

  it('getClasses: class with methods and properties', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
class Calculator {
  result: number = 0;

  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}
`)!;

    const classes = getClasses(tree);

    expect(classes).toHaveLength(1);
    expect(classes[0].name).toEqual("Calculator");
    expect(classes[0].methods.length).toBeGreaterThan(0);
    expect(classes[0].properties.length).toBeGreaterThan(0);
  });

  it('getClassMethods: extracts method names and types', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
class Service {
  process(data: string): void {
    console.log(data);
  }

  validate(): boolean {
    return true;
  }

  getName(): string {
    return "service";
  }
}
`)!;

    const classes = getClasses(tree);
    const methods = classes[0].methods;

    expect(methods.length).toBeGreaterThanOrEqual(1);
    const processMethod = methods.find(m => m.name === "process");
    expect(processMethod).toBeDefined();
  });

  // Function Tests
  it('getFunctions: single function', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
function greet(name: string): string {
  return \`Hello, \${name}\`;
}
`)!;

    const functions = getFunctions(tree);

    expect(functions).toHaveLength(1);
    expect(functions[0].name).toEqual("greet");
  });

  it('getFunctions: multiple functions', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
function add(a: number, b: number): number {
  return a + b;
}

function subtract(a: number, b: number): number {
  return a - b;
}

function multiply(a: number, b: number): number {
  return a * b;
}
`)!;

    const functions = getFunctions(tree);

    expect(functions).toHaveLength(3);
    expect(functions[0].name).toEqual("add");
    expect(functions[1].name).toEqual("subtract");
    expect(functions[2].name).toEqual("multiply");
  });

  it('getFunction: extracts return type', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
function getValue(): number {
  return 42;
}
`)!;

    const functions = getFunctions(tree);

    expect(functions).toHaveLength(1);
    expect(functions[0].returnType).toContain("number");
  });

  // Function Parameters Tests
  it('getFunctionParameters: single parameter', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
function greet(name: string): void {
  console.log(name);
}
`)!;

    const functions = getFunctions(tree);
    const params = functions[0].parameters;

    expect(params).toHaveLength(1);
    expect(params[0].name).toEqual("name");
    expect(params[0].type).toContain("string");
    expect(params[0].optional).toBe(false);
  });

  it('getFunctionParameters: multiple parameters', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
function calculate(a: number, b: number, operation: string): number {
  return a + b;
}
`)!;

    const functions = getFunctions(tree);
    const params = functions[0].parameters;

    expect(params.length).toBeGreaterThanOrEqual(1);
    expect(params.some(p => p.name === "a")).toBe(true);
    expect(params.some(p => p.name === "b")).toBe(true);
  });

  it('getFunctionParameters: optional parameters', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
function configure(host: string, port?: number): void {
  console.log(host);
}
`)!;

    const functions = getFunctions(tree);
    const params = functions[0].parameters;

    expect(params.length).toBeGreaterThanOrEqual(1);
  });

  it('getFunctionParameters: complex types', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
function processData(items: string[], config: { timeout: number }, callback?: (result: boolean) => void): void {
  console.log(items);
}
`)!;

    const functions = getFunctions(tree);
    const params = functions[0].parameters;

    expect(params.length).toBeGreaterThanOrEqual(1);
  });

  // Integration Tests
  it('comprehensive TypeScript file analysis', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
interface Logger {
  log(message: string): void;
  error(message: string): void;
}

type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

class DataService {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  getData(id: string): Result<any> {
    this.logger.log(\`Fetching data for \${id}\`);
    return { success: true };
  }

  processData(data: any[], transform: (item: any) => any): any[] {
    return data.map(transform);
  }
}

function createService(logger: Logger): DataService {
  return new DataService(logger);
}

export { DataService, type Result };
`)!;

    const interfaces = getInterfaces(tree);
    const types = getTypes(tree);
    const classes = getClasses(tree);
    const functions = getFunctions(tree);

    expect(interfaces.length).toBeGreaterThanOrEqual(1);
    expect(types.length).toBeGreaterThanOrEqual(1);
    expect(classes).toHaveLength(1);
    expect(functions).toHaveLength(1);

    // Verify interface
    const logger = interfaces.find(i => i.name === "Logger");
    expect(logger).toBeDefined();

    // Verify type
    const result = types.find(t => t.name === "Result");
    expect(result).toBeDefined();

    // Verify class
    expect(classes[0].name).toEqual("DataService");
    expect(classes[0].methods.length).toBeGreaterThanOrEqual(1);

    // Verify function
    expect(functions[0].name).toEqual("createService");
  });

  it('imports extraction', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
import { User } from './models';
import * as Utils from './utils';
import type { Config } from './config';

export const data = {};
`)!;

    const imports = getImports(tree.rootNode);

    expect(imports.length).toBeGreaterThanOrEqual(1);
  });

  it('interface with optional and required members', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
interface Response {
  status: number;
  message: string;
  data?: any;
  metadata?: Record<string, any>;
}
`)!;

    const interfaces = getInterfaces(tree);
    const members = interfaces[0].members;

    const required = members.filter(m => !m.optional);
    const optional = members.filter(m => m.optional);

    expect(required.length).toBeGreaterThan(0);
    expect(optional.length).toBeGreaterThan(0);
  });

  it('class with constructor and multiple method types', async () => {
    const parser = await createTypeScriptParser();
    const tree = parser.parse(`
class UserManager {
  private users: Map<string, any> = new Map();

  constructor(initialUsers?: any[]) {
    if (initialUsers) {
      initialUsers.forEach(u => this.users.set(u.id, u));
    }
  }

  addUser(user: any): void {
    this.users.set(user.id, user);
  }

  getUser(id: string): any | undefined {
    return this.users.get(id);
  }

  removeUser(id: string): boolean {
    return this.users.delete(id);
  }
}
`)!;

    const classes = getClasses(tree);

    expect(classes).toHaveLength(1);
    expect(classes[0].name).toEqual("UserManager");
    expect(classes[0].methods.length).toBeGreaterThanOrEqual(1);
    expect(classes[0].properties.length).toBeGreaterThanOrEqual(1);
  });

});
