
import { Parser, Language, Node, Tree } from 'web-tree-sitter';

import { log } from "./logger";
import { SyntaxNode } from 'tree-sitter';


interface Type {
  name: string;
  package?: string;
}

interface JavaMethod {
  name: string;
  signature: string;
  isStatic: boolean;
  returnType: string;
  typeReferences: Type[];
  comment?: string;
}

interface JavaField {
  name: string;
  type: Type;
  signature: string;
  static: boolean;
}

interface ClassInfo {
  name: string;
  fields: JavaField[];
  methods: JavaMethod[];
  type: "class" | "interface";
  comment?: string;
}

interface Import {
  wildcard: boolean;
  package: string;
  type: string;
}

interface FileData {
  filePath: string;
  filename: string;
  packageName: string | null;
  imports: Import[];
  definedClasses: ClassInfo[];
}


type ProjectData = Record<string, FileData>;

// Helper function to get text of a node
function getNodeText(node: SyntaxNode | null | undefined, sourceCode: string): string {
  if (!node) return '';
  return sourceCode.substring(node.startIndex, node.endIndex);
}


/**
 * We consider a type reference "useful" if it has an associated package and the package does not begin
 * with well known built-in packages.
 */
function addTypeReferenceIfUseful(refs: Type[], type: Type) {
  if (type.package && !isWellKnownBuiltinPackage(type.package)) {
    refs.push(type);
  }
}

const IGNORED_JAVA_PACKAGE_PREFIXES = [
  'java.',
  'javax.',
  'org.w3c.',
  'org.xml.',
  'com.sun.',
  'com.oracle.',
  'org.junit',
  'junit.',
  'org.hamcrest.',
  'ch.qos',
  'org.testcontainers',
  'org.slf4j',
  'org.apache.logging',
];

function isWellKnownBuiltinPackage(pkg: string): boolean {
  return IGNORED_JAVA_PACKAGE_PREFIXES.some(prefix => pkg.startsWith(prefix));
}

function isPrimitiveType(typeName: string): boolean {
  const primitiveTypes = new Set([
    'boolean', 'byte', 'char', 'short', 'int', 'long', 'float', 'double', 'void',
    'Boolean', 'Byte', 'Character', 'Short', 'Integer', 'Long', 'Float', 'Double',
    'String', 'Object'
  ]);
  return primitiveTypes.has(typeName);
}

function isCommonKeyword(word: string): boolean {
  const keywords = new Set([
    'this', 'super', 'null', 'true', 'false', 'return', 'if', 'else', 'for', 'while',
    'do', 'switch', 'case', 'default', 'break', 'continue', 'try', 'catch', 'finally',
    'throw', 'throws', 'public', 'private', 'protected', 'static', 'final', 'abstract',
    'synchronized', 'volatile', 'transient', 'native', 'strictfp', 'class', 'interface',
    'extends', 'implements', 'import', 'package', 'new', 'instanceof'
  ]);
  return keywords.has(word);
}

function* traverseTree(
  tree: Tree,
): Generator<SyntaxNode> {

  const cursor = tree.walk();

  let reachedRoot = false;
  while (!reachedRoot) {
    let currentNode = cursor.currentNode as unknown;
    // TreeCursor.currentNode is a property in Node but a function in the browser
    // https://github.com/tree-sitter/tree-sitter/issues/2195
    if (typeof currentNode === "function") {
      currentNode = currentNode();
    }
    yield currentNode as SyntaxNode;

    if (cursor.gotoFirstChild()) {
      continue;
    }

    if (cursor.gotoNextSibling()) {
      continue;
    }

    let retracing = true;
    while (retracing) {
      if (!cursor.gotoParent()) {
        retracing = false;
        reachedRoot = true;
      }

      if (cursor.gotoNextSibling()) {
        retracing = false;
      }
    }
  }
}


export function parseJavaFile(parser: Parser, relativePath: string, fileName: string, sourceCode: string): FileData {
  const tree = parser.parse(sourceCode);

  const generator = traverseTree(tree!);

  for (const node of generator) {
    // log.info(`Visited node: ${node.type} at (${node.startPosition.row}, ${node.startPosition.column})`);

    if (node.type === "package_declaration") {
      log.info(`Found package declaration: ${node.text}`);
    }

    if (node.type === "package") {
      log.info(`Found package: ${node.text}`);
    }

  }

  const rootNode = tree!.rootNode;

  const fileData: FileData = {
    filePath: relativePath,
    filename: fileName,
    packageName: null,
    imports: [],
    definedClasses: [],
  };


  return fileData;
}

// Create a parser with Java language support
export async function createJavaParser(): Promise<Parser> {

  await Parser.init();

  const Java = await Language.load('public/tree-sitter-java.wasm');

  const parser = new Parser();
  parser.setLanguage(Java);

  return parser;
}

// Export the main parsing function and types
export {
  type FileData,
  type ProjectData,
  type ClassInfo,
  type JavaMethod,
  type JavaField,
  type Import,
  type Type
};
