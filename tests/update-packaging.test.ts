import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import yaml from 'js-yaml'

interface BuilderConfig {
  appId?: string
  productName?: string
  electronUpdaterCompatibility?: string
  publish?: { provider?: string; owner?: string; repo?: string; channel?: string; releaseType?: string }
  mac?: { target?: Array<{ target?: string; arch?: string[] }>; artifactName?: string }
  dmg?: { artifactName?: string }
}

test('il packaging produce un canale GitHub aggiornabile arm64 in bozza', () => {
  const builder = yaml.load(readFileSync(new URL('../electron-builder.yml', import.meta.url), 'utf8')) as BuilderConfig
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const releaseScript = readFileSync(new URL('../scripts/release-github.mjs', import.meta.url), 'utf8')

  assert.equal(builder.appId, 'com.cerbonesphoto.app')
  assert.equal(builder.productName, 'CerbonesPhoto')
  assert.equal(builder.electronUpdaterCompatibility, '>= 2.16')
  assert.deepEqual(builder.publish, {
    provider: 'github', owner: 'dimaurovincenzo', repo: 'CerbonesPhoto',
    channel: 'latest', releaseType: 'draft'
  })
  assert.deepEqual(builder.mac?.target, [
    { target: 'dmg', arch: ['arm64'] },
    { target: 'zip', arch: ['arm64'] }
  ])
  assert.equal(pkg.name, 'cerbones-photo')
  assert.equal(pkg.repository.url, 'https://github.com/dimaurovincenzo/CerbonesPhoto.git')
  assert.match(releaseScript, /findLiteralSecrets/)
  assert.match(releaseScript, /app\.asar/)
})
