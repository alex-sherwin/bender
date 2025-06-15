import fs from 'node:fs/promises';
import path from 'node:path';
import Parser from 'tree-sitter';
import JavaImport from 'tree-sitter-java';

import { log } from "./logger";

const Java = JavaImport as Parser.Language;

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

const parser = new Parser();

// Helper function to get text of a node
function getNodeText(node: Parser.SyntaxNode | null | undefined, sourceCode: string): string {
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

function parseClassNode(classNode: Parser.SyntaxNode, sourceCode: string, fileData: FileData, type: ClassInfo["type"]): ClassInfo {

  const classNameNode = classNode.childForFieldName('name');
  if (!classNameNode) {
    throw new Error('Class node missing name');
  }

  const className = getNodeText(classNameNode, sourceCode);
  // log.debug(`className [${className}]`);

  const classInfo: ClassInfo = { type, name: className, fields: [], methods: [] };

  const classBodyNode = classNode.childForFieldName('body');
  if (!classBodyNode) {
    return classInfo;
  }

  // Process all children of the class body
  classBodyNode.children.forEach(child => {
    switch (child.type) {

      case 'constant_declaration': {
        const field = parseConstantNode(fileData, child, sourceCode);
        if (field) {
          classInfo.fields.push(field);
        }
        break;
      }

      case 'field_declaration': {
        const field = parseFieldNode(fileData, child, sourceCode);
        if (field) {
          classInfo.fields.push(field);
        }
        break;
      }

      case 'method_declaration': {
        const method = parseMethodNode(child, sourceCode, fileData);
        if (method) {
          classInfo.methods.push(method);
        }
        break;
      }

      case 'interface_declaration': {
        // Recursively parse nested classes
        const nestedClass = parseClassNode(child, sourceCode, fileData, "interface");
        fileData.definedClasses.push(nestedClass);
        break;
      }

      case 'class_declaration': {
        // Recursively parse nested classes
        const nestedClass = parseClassNode(child, sourceCode, fileData, "class");
        fileData.definedClasses.push(nestedClass);
        break;
      }

      default: {
        log.warn(`[${className}] Unhandled class node type: ${child.type}`);
        break;
      }

    }

  });

  return classInfo;
}

function parseConstantNode(fileData: FileData, constantNode: Parser.SyntaxNode, sourceCode: string): JavaField | null {
  const typeNode = constantNode.childForFieldName('type');
  const declaratorNode = constantNode.children.find(c => c.type === 'variable_declarator');
  const nameNode = declaratorNode?.childForFieldName('name');

  if (!nameNode) return null;

  // Check if field is static
  const isStatic = constantNode.children.some(child =>
    child.type === 'modifiers' &&
    child.children.some(modifier => modifier.type === 'static')
  );

  const fieldType = typeNode ? getNodeText(typeNode, sourceCode) : 'unknown';
  const fieldName = getNodeText(nameNode, sourceCode);
  const imp = findImport(fileData, fieldType);
  const pkg = imp?.package;

  const type: Type = {
    name: fieldType,
    package: pkg,
  };

  return {
    name: fieldName,
    // type: fieldType,
    type,
    signature: `${fieldType} ${fieldName}`,
    static: isStatic
  };
}

function findImport(fileData: FileData, typeName: string): Import | null {

  const exactMatch = fileData.imports.find(imp => !imp.wildcard && imp.type === typeName);
  if (exactMatch) {
    return exactMatch;
  }

  return null;
}



function parseFieldNode(fileData: FileData, fieldNode: Parser.SyntaxNode, sourceCode: string): JavaField | null {

  const typeNode = fieldNode.childForFieldName('type');

  const declaratorNode = fieldNode.children.find(c => c.type === 'variable_declarator');
  const nameNode = declaratorNode?.childForFieldName('name');

  if (!nameNode) {
    return null;
  }

  // Check if field is static
  const isStatic = fieldNode.children.some(child =>
    child.type === 'modifiers' &&
    child.children.some(modifier => modifier.type === 'static')
  );

  const fieldType = typeNode ? getNodeText(typeNode, sourceCode) : 'unknown';
  const fieldName = getNodeText(nameNode, sourceCode);
  const imp = findImport(fileData, fieldType);
  const pkg = imp?.package;

  const type: Type = {
    name: fieldType,
    package: pkg,
  };

  return {
    name: fieldName,
    // type: fieldType,
    type,
    signature: `${fieldType} ${fieldName}`,
    static: isStatic
  };
}

function extractTypeReferencesFromMethodBody(methodNode: Parser.SyntaxNode, sourceCode: string, fileData: FileData): Type[] {

  const typeReferences: Type[] = [];
  const seenTypes = new Set<string>();

  function visitNode(node: Parser.SyntaxNode) {
    // Look for type references in various contexts
    switch (node.type) {
      case 'type_identifier':
      case 'identifier': {
        const typeName = getNodeText(node, sourceCode);

        if (typeName === 'BEGIN_CERT') {
          log.debug(`Found type identifier: ${typeName}`);
        }

        // Skip primitive types and common keywords
        if (isPrimitiveType(typeName) || isCommonKeyword(typeName)) {
          break;
        }

        // Check if this looks like a type reference (starts with uppercase)
        if (typeName && typeName[0] === typeName[0].toUpperCase() && !seenTypes.has(typeName)) {
          seenTypes.add(typeName);

          const imp = findImport(fileData, typeName);
          const pkg = imp?.package;

          addTypeReferenceIfUseful(typeReferences, {
            name: typeName,
            package: pkg,
          });

        }
        break;
      }

      case 'object_creation_expression': {
        // Handle 'new SomeClass()' expressions
        const typeNode = node.childForFieldName('type');
        if (typeNode) {
          const typeName = getNodeText(typeNode, sourceCode);
          if (typeName && !seenTypes.has(typeName) && !isPrimitiveType(typeName)) {
            seenTypes.add(typeName);

            const imp = findImport(fileData, typeName);
            const pkg = imp?.package;

            addTypeReferenceIfUseful(typeReferences, {
              name: typeName,
              package: pkg,
            });
          }
        }
        break;
      }

      case 'cast_expression': {
        // Handle casting expressions like (SomeClass) object
        const typeNode = node.childForFieldName('type');
        if (typeNode) {
          const typeName = getNodeText(typeNode, sourceCode);
          if (typeName && !seenTypes.has(typeName) && !isPrimitiveType(typeName)) {
            seenTypes.add(typeName);

            const imp = findImport(fileData, typeName);
            const pkg = imp?.package;

            addTypeReferenceIfUseful(typeReferences, {
              name: typeName,
              package: pkg,
            });
          }
        }
        break;
      }

      case 'variable_declaration': {
        // Handle local variable declarations
        const typeNode = node.childForFieldName('type');
        if (typeNode) {
          const typeName = getNodeText(typeNode, sourceCode);
          if (typeName && !seenTypes.has(typeName) && !isPrimitiveType(typeName)) {
            seenTypes.add(typeName);

            const imp = findImport(fileData, typeName);
            const pkg = imp?.package;

            addTypeReferenceIfUseful(typeReferences, {
              name: typeName,
              package: pkg,
            });
          }
        }
        break;
      }
    }

    // Recursively visit all child nodes
    node.children.forEach(visitNode);
  }

  // Find the method body and traverse it
  const bodyNode = methodNode.childForFieldName('body');
  if (bodyNode) {
    visitNode(bodyNode);
  }

  return typeReferences;
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

function parseMethodNode(methodNode: Parser.SyntaxNode, sourceCode: string, fileData: FileData): JavaMethod | null {
  const returnTypeNode = methodNode.childForFieldName('type');
  const nameNode = methodNode.childForFieldName('name');
  const paramsNode = methodNode.childForFieldName('parameters');

  if (!nameNode) return null;

  const methodName = getNodeText(nameNode, sourceCode);
  const returnType = returnTypeNode ? getNodeText(returnTypeNode, sourceCode) : 'void';

  // Check if method is static
  const isStatic = methodNode.children.some(child =>
    child.type === 'modifiers' &&
    child.children.some(modifier => modifier.type === 'static')
  );

  const params: { name: string, type: string }[] = [];
  if (paramsNode) {
    paramsNode.children.filter(p => p.type === 'formal_parameter').forEach(param => {
      const paramTypeNode = param.childForFieldName('type');
      const paramNameNode = param.childForFieldName('name');
      if (paramTypeNode && paramNameNode) {
        params.push({
          name: getNodeText(paramNameNode, sourceCode),
          type: getNodeText(paramTypeNode, sourceCode)
        });
      }
    });
  }

  const paramsString = params.map(p => `${p.type} ${p.name}`).join(', ');

  // Extract type references from method body
  const typeReferences = extractTypeReferencesFromMethodBody(methodNode, sourceCode, fileData);

  return {
    name: methodName,
    returnType: returnType,
    signature: `${returnType} ${methodName}(${paramsString})`,
    isStatic: isStatic,
    typeReferences: typeReferences
  };
}

function parsePackageNode(packageNode: Parser.SyntaxNode, sourceCode: string): string {
  // Package name can be either identifier or scoped_identifier
  const nameNode = packageNode.children.find(child =>
    child.type === 'identifier' || child.type === 'scoped_identifier'
  );
  return nameNode ? getNodeText(nameNode, sourceCode) : '';
}

function parseImportNode(importNode: Parser.SyntaxNode, sourceCode: string): Import | null {

  // Import name can be either identifier or scoped_identifier
  const nameNode = importNode.children.find(child =>
    child.type === 'identifier' || child.type === 'scoped_identifier'
  );

  if (!nameNode) {
    return null;
  }

  let importName = getNodeText(nameNode, sourceCode);

  const wildcard = importNode.children.some(child => child.type === 'asterisk');
  const type = wildcard ? '*' : importName.split('.').pop() ?? importName;
  const pkg = wildcard ? importName : importName.split('.').slice(0, -1).join('.');

  return { wildcard, type, package: pkg };
}

async function parseJavaFile(relativePath: string, filePath: string, sourceCode: string): Promise<FileData> {
  const tree = parser.parse(sourceCode);
  const rootNode = tree.rootNode;

  const fileData: FileData = {
    // filePath: path.resolve(filePath), // Store absolute path
    filePath: relativePath,
    filename: path.basename(filePath),
    packageName: null,
    imports: [],
    definedClasses: [],
  };

  // Iterate through all top-level nodes
  rootNode.children.forEach(node => {

    // console.log(`node.type [${node.type}]`);

    switch (node.type) {

      case 'package_declaration': {
        fileData.packageName = parsePackageNode(node, sourceCode);
        break;
      }

      case 'import_declaration': {
        const imp0rt = parseImportNode(node, sourceCode);
        if (imp0rt) {
          fileData.imports.push(imp0rt);
        }
        break;
      }

      case 'interface_declaration': {
        const classInfo = parseClassNode(node, sourceCode, fileData, "interface");
        fileData.definedClasses.push(classInfo);
        break;
      }

      case 'class_declaration': {
        const classInfo = parseClassNode(node, sourceCode, fileData, "class");
        fileData.definedClasses.push(classInfo);
        break;
      }

      default: {
        log.warn(`Unhandled top-level node type: ${node.type}`);
        break;
      }


    }
  });

  return fileData;
}

async function scanDirectory(projectRootDir: string, dirPath: string, projectData: ProjectData): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await scanDirectory(projectRootDir, fullPath, projectData);
    } else if (entry.isFile() && entry.name.endsWith('.java')) {
      log.debug(`Parsing: ${fullPath}`);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const relativePath = path.relative(projectRootDir, fullPath);
        log.warn(`projectRootDir [${projectRootDir}]`);
        const fileAstData = await parseJavaFile(relativePath, fullPath, content);
        projectData[fileAstData.filePath] = fileAstData;
      } catch (error) {
        log.error(`Error parsing file ${fullPath}:`, error);
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    log.error('Usage: ts-node extractor.ts <maven_project_root_dir> [output_file.json]');
    process.exit(1);
  }

  const projectRootDir = path.resolve(args[0]);
  const outputFilePath = args[1] ? path.resolve(args[1]) : path.resolve(projectRootDir, 'project-data.json');

  if (!await fs.stat(projectRootDir).then(s => s.isDirectory()).catch(() => false)) {
    log.error(`Error: Project root directory not found: ${projectRootDir}`);
    process.exit(1);
  }

  try {
    parser.setLanguage(Java);
  } catch (e) {
    log.error("Failed to set Tree-sitter Java language. Ensure tree-sitter-java.wasm is accessible.", e);
    log.error("You might need to copy 'tree-sitter.wasm' from 'node_modules/tree-sitter/' and 'tree-sitter-java.wasm' from 'node_modules/tree-sitter-java/wasm/' to your project directory or ensure your NODE_PATH is set up correctly.");
    process.exit(1);
  }


  const projectData: ProjectData = {};
  const javaSrcDirs = [
    path.join(projectRootDir, 'src', 'main', 'java'),
    path.join(projectRootDir, 'src', 'test', 'java'),
  ];

  for (const srcDir of javaSrcDirs) {
    if (await fs.stat(srcDir).then(s => s.isDirectory()).catch(() => false)) {
      log.info(`Scanning directory: ${srcDir}`);

      await scanDirectory(projectRootDir, srcDir, projectData);
    } else {
      log.warn(`Directory not found, skipping: ${srcDir}`);
    }
  }

  await fs.mkdir(path.dirname(outputFilePath), { recursive: true });

  await fs.writeFile(outputFilePath, JSON.stringify(projectData, null, 2));
  log.info(`Project data extracted to: ${outputFilePath}`);
}

main().catch(log.error);
