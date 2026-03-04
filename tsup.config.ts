import {defineConfig} from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  // Remove console.logs during the build step using esbuild options
  esbuildOptions(options, context) {
    if (context.format === 'cjs' || context.format === 'esm') {
      options.drop = ['console']
    }
  },
})
