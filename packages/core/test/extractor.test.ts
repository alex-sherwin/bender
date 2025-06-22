import { describe, it, expect } from 'vitest';

import { parseJavaFile, createJavaParser, getPackage, traverseTree, findFirstNodeOfType, getFullyQualifiedImport } from "../src/extractor2";


describe('extractor', () => {

  it('package declaration should be package only', async () => {

    const parser = await createJavaParser();
    const tree = parser.parse(`
package com.example.test;

public class Test { }
`)!;

    const gen = traverseTree(tree);



    let packageName: string | null = null;

    for (const node of gen) {
      if (node.type === "package_declaration") {
        packageName = getPackage(node);
      }
    }

    expect(packageName).toEqual("com.example.test");

    //     parseJavaFile(parser, 'src/test/Test.java', 'Test.java', `
    // package com.example.test;

    // public class Test { }
    // `);

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

});

