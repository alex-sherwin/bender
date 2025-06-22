import { describe, it, expect } from 'vitest';

import { getImports, findLastNodeOfType, parseJavaFile, createJavaParser, traverseTree, findFirstNodeOfType, getFullyQualifiedImport, getFilePackage } from "../src/extractor2";
import type { Import } from '../src/types';


describe('extractor', () => {

  it('getImports', async () => {

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import javax.net.wild.*;

public class Test { }
`)!;

    const imports = getImports(tree.rootNode);

    expect(imports).toHaveLength(3);
    expect(imports[0]).toEqual({ pkg: "javax.net.ssl", type: "TrustManager", wildcard: false } satisfies Import);
    expect(imports[1]).toEqual({ pkg: "javax.net.ssl", type: "X509TrustManager", wildcard: false } satisfies Import);
    expect(imports[2]).toEqual({ pkg: "javax.net.wild", type: "*", wildcard: true } satisfies Import);

  });

  it('findFirstNodeOfType: package (found)', async () => {

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class Test { }
`)!;

    const node = findFirstNodeOfType(tree, "package_declaration");
    expect(node?.type).toEqual("package_declaration");

  });

  it('findFirstNodeOfType: import (missing)', async () => {

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class Test { }
`)!;

    const node = findFirstNodeOfType(tree, "import_declaration");
    expect(node?.type ?? null).toBeNull()

  });

  it('findFirstNodeOfType: import (found)', async () => {

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public class Test { }
`)!;

    const node = findFirstNodeOfType(tree, "import_declaration");
    expect(node).not.toBeNull();
    expect(node?.type).toEqual("import_declaration")
  });

  it('getFullyQualifiedImport', async () => {

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public class Test { }
`)!;

    const node = findFirstNodeOfType(tree, "import_declaration");

    expect(node).not.toBeNull();
    expect(node?.type).toEqual("import_declaration")

    expect(getFullyQualifiedImport(node!)).toEqual("javax.net.ssl.TrustManager");

  });

  it('getFullyQualifiedImport', async () => {

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public class Test { }
`)!;

    expect(getFilePackage(tree)).toEqual("com.example.test");

  });

});

