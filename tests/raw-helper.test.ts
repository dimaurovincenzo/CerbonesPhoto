import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { RawHelper, RawHelperError } from '../src/main/photo/raw-helper.ts'

function executable(path: string, body: string): void {
  writeFileSync(path, `#!/usr/bin/env node\n${body}\n`)
  chmodSync(path, 0o755)
}

test('estrae la preview in cache senza shell e senza scrivere accanto al RAW', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'cerbonesphoto-raw-helper-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const source = join(directory, "ritratto; touch NON_DEVE_ESISTERE.cr3")
  const output = join(directory, 'cache', 'preview.jpg')
  const fake = join(directory, 'simple-dcraw')
  writeFileSync(source, 'originale')
  executable(fake, `
    const fs = require('node:fs')
    const input = process.argv.at(-1)
    fs.writeFileSync(input + '.thumb.jpg', 'preview')
  `)

  const helper = new RawHelper({ simpleDcrawPath: fake, timeoutMs: 1000 })
  await helper.extractPreview(source, output, new AbortController().signal)

  assert.equal(readFileSync(output, 'utf8'), 'preview')
  assert.equal(readFileSync(source, 'utf8'), 'originale')
  assert.equal(existsSync(join(directory, 'NON_DEVE_ESISTERE')), false)
  assert.equal(existsSync(`${source}.thumb.jpg`), false)
})

test('trasforma il timeout del processo in errore stabile', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'cerbonesphoto-raw-timeout-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const source = join(directory, 'foto.nef')
  const fake = join(directory, 'simple-dcraw')
  writeFileSync(source, 'raw')
  executable(fake, `setTimeout(() => process.exit(0), 500)`)
  const helper = new RawHelper({ simpleDcrawPath: fake, timeoutMs: 20 })

  await assert.rejects(
    helper.extractPreview(source, join(directory, 'preview.jpg'), new AbortController().signal),
    (error) => error instanceof RawHelperError && error.code === 'ENGINE_TIMEOUT'
  )
})

test('segnala come non disponibile un binario LibRaw inesistente', async () => {
  const helper = new RawHelper({ simpleDcrawPath: '/percorso/inesistente/simple_dcraw', timeoutMs: 100 })

  const health = await helper.health()

  assert.equal(health.available, false)
  assert.equal(health.errorCode, 'ENGINE_UNAVAILABLE')
})

test('riconosce versione e architettura del motore LibRaw vendorizzato', async () => {
  const binary = join(process.cwd(), 'resources', 'bin', 'darwin-arm64', 'simple_dcraw')
  const helper = new RawHelper({ simpleDcrawPath: binary, timeoutMs: 1000 })

  const health = await helper.health()

  assert.equal(health.available, true)
  assert.equal(health.version, '0.22.2')
  assert.equal(health.architecture, 'arm64')
})
