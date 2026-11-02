import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')

describe('vite entry', () => {
  it('imports defineViewerConfig from ./vite in plain Node context', () => {
    // Test that the vite entry can be imported by Node without a Vite/Vitest transform.
    // This simulates what happens when a vite.config.js imports from @museumwnf/viewer-core/vite.
    const viteConfigPath = pathToFileURL(join(packageRoot, 'src/testing/viteConfig.js')).href
    const output = execFileSync('node', [
      '--input-type=module',
      '-e',
      `import('${viteConfigPath}').then(m => {
        if (typeof m.defineViewerConfig !== 'function') process.exit(2)
        console.log(JSON.stringify(Object.keys(m.defineViewerConfig({ dataPackage: '@museumwnf/x-data' }))))
      })`,
    ], { encoding: 'utf-8' })

    const keys = JSON.parse(output)
    expect(keys).toContain('plugins')
    expect(keys).toContain('resolve')
    expect(keys).toContain('optimizeDeps')
    expect(keys).toContain('test')
  })

  it("turns Node's own Web Storage off for a website's tests, so jsdom's localStorage is the one they see", async () => {
    const { defineViewerConfig } = await import('../src/testing/viteConfig.js')
    expect(defineViewerConfig({ dataPackage: '@museumwnf/x-data' }).test.execArgv).toEqual(['--no-experimental-webstorage'])
  })

  it('fails to import from ./testing barrel in plain Node context (control)', () => {
    // Document why the vite entry is separate: the barrel reaches a .vue file,
    // which Node cannot parse without Vite/Vitest's transform.
    const testingIndexPath = pathToFileURL(join(packageRoot, 'src/testing/index.js')).href
    let error = null
    try {
      execFileSync('node', [
        '--input-type=module',
        '-e',
        `import('${testingIndexPath}')`,
      ], { encoding: 'utf-8' })
    } catch (e) {
      error = e.stderr || e.stdout || e.message
    }

    expect(error).toBeTruthy()
    expect(error).toMatch(/ERR_UNKNOWN_FILE_EXTENSION/)
  })
})
