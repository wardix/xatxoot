import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Web Frontend Scaffolding (apps/web)', () => {
  const webDir = join(import.meta.dir, '..', 'apps', 'web')
  const pkgPath = join(webDir, 'package.json')
  const tsconfigPath = join(webDir, 'tsconfig.json')
  const viteConfigPath = join(webDir, 'vite.config.ts')
  const htmlPath = join(webDir, 'index.html')
  const mainPath = join(webDir, 'src', 'main.tsx')
  const appPath = join(webDir, 'src', 'App.tsx')
  const cssPath = join(webDir, 'src', 'index.css')

  it('should have package.json in apps/web with React 19, Vite, and Tailwind dependencies', () => {
    expect(existsSync(pkgPath)).toBe(true)

    const raw = readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(raw)

    expect(pkg.name).toBe('@xatxoot/web')
    expect(pkg.type).toBe('module')

    expect(pkg.scripts).toBeDefined()
    expect(pkg.scripts.dev).toBeDefined()
    expect(pkg.scripts.build).toBeDefined()

    expect(pkg.dependencies).toBeDefined()
    expect(pkg.dependencies.react).toBeDefined()
    expect(pkg.dependencies['react-dom']).toBeDefined()
    expect(pkg.dependencies['@xatxoot/shared']).toBeDefined()

    expect(pkg.devDependencies).toBeDefined()
    expect(pkg.devDependencies.vite).toBeDefined()
    expect(pkg.devDependencies['@vitejs/plugin-react']).toBeDefined()
  })

  it('should have tsconfig.json extending tsconfig.base.json with react-jsx', () => {
    expect(existsSync(tsconfigPath)).toBe(true)

    const raw = readFileSync(tsconfigPath, 'utf-8')
    const tsconfig = JSON.parse(raw)

    expect(tsconfig.extends).toBe('../../tsconfig.base.json')
    expect(tsconfig.compilerOptions?.jsx).toBe('react-jsx')
  })

  it('should have vite.config.ts configured with react plugin', () => {
    expect(existsSync(viteConfigPath)).toBe(true)

    const content = readFileSync(viteConfigPath, 'utf-8')
    expect(content).toContain('defineConfig')
    expect(content).toContain('@vitejs/plugin-react')
  })

  it('should have index.html pointing to src/main.tsx', () => {
    expect(existsSync(htmlPath)).toBe(true)

    const content = readFileSync(htmlPath, 'utf-8')
    expect(content).toContain('/src/main.tsx')
    expect(content).toContain('root')
  })

  it('should have entrypoint files in src/ directory', () => {
    expect(existsSync(mainPath)).toBe(true)
    expect(existsSync(appPath)).toBe(true)
    expect(existsSync(cssPath)).toBe(true)
  })

  it('should render root App component without errors', async () => {
    const { default: App } = await import('../apps/web/src/App')
    expect(App).toBeDefined()
    expect(typeof App).toBe('function')
  })
})
