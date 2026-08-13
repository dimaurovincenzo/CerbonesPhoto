import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import test from 'node:test'
import { extractFile, listPackage } from '@electron/asar'
import {
  buildReleaseManifest,
  findLiteralSecrets,
  validateReleaseContext,
  type ReleaseContext
} from '../scripts/release-preflight.mjs'

const valid: ReleaseContext = {
  platform: 'darwin',
  architecture: 'arm64',
  branch: 'main',
  status: '',
  packageVersion: '0.1.0',
  lockVersion: '0.1.0',
  origin: 'https://github.com/dimaurovincenzo/CerbonesPhoto.git',
  remoteTag: ''
}

test('il preflight accetta soltanto il contesto release approvato', () => {
  assert.deepEqual(validateReleaseContext(valid), [])
  const cases: Array<[Partial<ReleaseContext>, string]> = [
    [{ platform: 'linux' }, 'macOS'],
    [{ architecture: 'x64' }, 'arm64'],
    [{ branch: 'feature/test' }, 'main'],
    [{ status: ' M package.json' }, 'worktree'],
    [{ lockVersion: '0.1.1' }, 'versioni'],
    [{ origin: 'https://github.com/example/other.git' }, 'origin'],
    [{ remoteTag: 'abc123\trefs/tags/v0.1.0' }, 'esiste già']
  ]

  for (const [patch, message] of cases) {
    assert.match(validateReleaseContext({ ...valid, ...patch }).join(' '), new RegExp(message, 'i'))
  }
})

test('rileva credenziali letterali ma consente riferimenti ai secret CI', () => {
  const findings = findLiteralSecrets({
    '.github/workflows/ci.yml': 'GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
    'unsafe.env': 'GH_TOKEN=ghp_example\nCSC_KEY_PASSWORD="segreta"',
    'source.ts': "const CSC_LINK = process.env['CSC_LINK']"
  })

  assert.deepEqual(findings, ['unsafe.env:1:GH_TOKEN', 'unsafe.env:2:CSC_KEY_PASSWORD'])
})

test('repository e bundle ASAR non contengono credenziali di release letterali', () => {
  const project = resolve(import.meta.dirname, '..')
  const repositoryFiles = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: project, encoding: 'utf8' }
  ).split('\0').filter(Boolean)
  const files = Object.fromEntries(
    repositoryFiles.map((path) => [path, readFileSync(resolve(project, path), 'utf8')])
  )

  const archive = resolve(project, 'dist/mac-arm64/CerbonesPhoto.app/Contents/Resources/app.asar')
  if (existsSync(archive)) {
    const textExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.ts', '.txt', '.yml', '.yaml'])
    for (const archivePath of listPackage(archive, { isPack: false })) {
      if (!textExtensions.has(extname(archivePath))) continue
      files[`app.asar:${archivePath}`] = extractFile(archive, archivePath.replace(/^\//, '')).toString('utf8')
    }
  }

  assert.deepEqual(findLiteralSecrets(files), [])
})

test('costruisce manifest e note della bozza con checksum espliciti', () => {
  const manifest = buildReleaseManifest('0.1.0', {
    'CerbonesPhoto-0.1.0-arm64.dmg': 'a'.repeat(64),
    'CerbonesPhoto-0.1.0-arm64-mac.zip': 'b'.repeat(64),
    'latest-mac.yml': 'c'.repeat(64)
  })

  assert.equal(manifest.tag, 'v0.1.0')
  assert.deepEqual(manifest.artifacts, [
    'dist/CerbonesPhoto-0.1.0-arm64.dmg',
    'dist/CerbonesPhoto-0.1.0-arm64-mac.zip',
    'dist/latest-mac.yml'
  ])
  assert.match(manifest.notes, /^> \*\*Build provvisoria non notarizzata\*\*/)
  assert.match(manifest.notes, new RegExp(`CerbonesPhoto-0.1.0-arm64.dmg.*${'a'.repeat(64)}`, 's'))
})
