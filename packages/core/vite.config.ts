
/// <reference types="vitest/config" />

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: './src/extractor2.ts',
      name: 'index',
      fileName: 'index',
      formats: ["es"],
    },
  },
  test: {

  },
})
