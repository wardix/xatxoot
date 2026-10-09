import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Biome configuration (biome.json)', () => {
  const biomePath = join(import.meta.dir, '..', 'biome.json')

  it('should exist at repository root', () => {
    expect(existsSync(biomePath)).toBe(true)
  })

  it('should have valid Biome configuration adhering to AGENTS.md', () => {
    const raw = readFileSync(biomePath, 'utf-8')
    const config = JSON.parse(raw)

    expect(config.formatter).toBeDefined()
    expect(config.formatter.indentStyle).toBe('space')
    expect(config.formatter.indentWidth).toBe(2)
    expect(config.formatter.lineWidth).toBe(100)
    expect(config.formatter.lineEnding).toBe('lf')

    expect(config.javascript).toBeDefined()
    expect(config.javascript.formatter).toBeDefined()
    expect(config.javascript.formatter.quoteStyle).toBe('single')
    expect(config.javascript.formatter.jsxQuoteStyle).toBe('double')
    expect(config.javascript.formatter.semicolons).toBe('asNeeded')

    expect(config.organizeImports).toBeDefined()
    expect(config.organizeImports.enabled).toBe(true)
  })

  it('should pass biome check command across entire monorepo without errors or warnings', () => {
    const proc = Bun.spawnSync(['bunx', '@biomejs/biome', 'check', '.'], {
      cwd: join(import.meta.dir, '..'),
    })
    expect(proc.exitCode).toBe(0)
  })
})
