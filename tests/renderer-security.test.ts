import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('la CSP consente solo il protocollo preview locale per le richieste foto', () => {
  const html = readFileSync(new URL('../src/renderer/index.html', import.meta.url), 'utf8')
  const policy = /Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] ?? ''

  assert.match(policy, /connect-src 'self' preview:/)
  assert.doesNotMatch(policy, /connect-src[^;]*https?:/)

  const protocolSource = readFileSync(new URL('../src/main/media-protocol.ts', import.meta.url), 'utf8')
  const previewPrivileges = /scheme: 'preview',[\s\S]*?privileges: \{([\s\S]*?)\n\s*\}/.exec(protocolSource)?.[1] ?? ''
  assert.match(previewPrivileges, /supportFetchAPI: true/)
  assert.match(previewPrivileges, /corsEnabled: true/)
  assert.doesNotMatch(previewPrivileges, /bypassCSP: true/)
})
