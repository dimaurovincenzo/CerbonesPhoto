import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('il foglio stile globale ha blocchi CSS bilanciati', () => {
  const css = readFileSync(new URL('../src/renderer/src/styles/global.css', import.meta.url), 'utf8')
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const opens = (withoutComments.match(/{/g) ?? []).length
  const closes = (withoutComments.match(/}/g) ?? []).length

  assert.equal(closes, opens, `blocchi CSS non bilanciati: ${opens} aperture, ${closes} chiusure`)
})

function contrast(foreground: string, background: string): number {
  const luminance = (hex: string): number => {
    const values = hex.match(/[a-f\d]{2}/gi)?.map((part) => Number.parseInt(part, 16) / 255) ?? []
    const [red, green, blue] = values.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }
  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

test('i testi secondari rispettano il contrasto minimo in tema chiaro e scuro', () => {
  assert.ok(contrast('#6e6e73', '#f5f5f7') >= 4.5)
  assert.ok(contrast('#a1a1a6', '#1c1c1e') >= 4.5)
})
