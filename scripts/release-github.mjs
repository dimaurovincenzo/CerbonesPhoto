import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, basename, join } from 'node:path'
import { extractFile, listPackage } from '@electron/asar'
import { buildReleaseManifest, findLiteralSecrets, validateReleaseContext } from './release-preflight.mjs'

const project = process.cwd()
const repository = 'dimaurovincenzo/CerbonesPhoto'

function capture(command, args, allowFailure = false) {
  const result = spawnSync(command, args, { cwd: project, encoding: 'utf8', shell: false })
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(' ')}: ${(result.stderr || result.stdout).trim()}`)
  }
  return (result.stdout || '').trim()
}

function run(command, args, acceptedStatuses = [0]) {
  const result = spawnSync(command, args, { cwd: project, stdio: 'inherit', shell: false })
  if (!acceptedStatuses.includes(result.status ?? -1)) {
    throw new Error(`${command} ${args.join(' ')} terminato con stato ${result.status ?? 'sconosciuto'}`)
  }
  return result.status ?? -1
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function assertNoLiteralReleaseSecrets(appPath) {
  const files = {}
  const repositoryFiles = capture('git', ['ls-files', '-z']).split('\0').filter(Boolean)
  for (const path of repositoryFiles) files[path] = await readFile(join(project, path), 'utf8')

  const archive = join(appPath, 'Contents/Resources/app.asar')
  const textExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.ts', '.txt', '.yml', '.yaml'])
  for (const archivePath of listPackage(archive, { isPack: false })) {
    if (!textExtensions.has(extname(archivePath))) continue
    files[`app.asar:${archivePath}`] = extractFile(archive, archivePath.replace(/^\//, '')).toString('utf8')
  }

  const findings = findLiteralSecrets(files)
  if (findings.length > 0) {
    // I risultati contengono soltanto percorso, riga e nome variabile: mai il valore sensibile.
    throw new Error(`Credenziali letterali rilevate:\n- ${findings.join('\n- ')}`)
  }
}

const packageJson = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
const packageLock = JSON.parse(await readFile(join(project, 'package-lock.json'), 'utf8'))
const version = packageJson.version
const tag = `v${version}`
const context = {
  platform: process.platform,
  architecture: process.arch,
  branch: capture('git', ['branch', '--show-current']),
  status: capture('git', ['status', '--porcelain']),
  packageVersion: version,
  lockVersion: packageLock.version,
  origin: capture('git', ['remote', 'get-url', 'origin']),
  remoteTag: capture('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`])
}
const errors = validateReleaseContext(context)
if (errors.length > 0) throw new Error(`Preflight release fallito:\n- ${errors.join('\n- ')}`)

run('npm', ['test'])
run('npm', ['run', 'typecheck'])
run('npm', ['run', 'build'])
run('npm', ['run', 'verify:photo-engines'])
run('npx', ['electron-builder', '--mac', '--arm64', '--publish', 'never'])

const appPath = join(project, 'dist/mac-arm64/CerbonesPhoto.app')
await assertNoLiteralReleaseSecrets(appPath)
run('codesign', ['--verify', '--deep', '--strict', appPath])
const executable = join(appPath, 'Contents/MacOS/CerbonesPhoto')
const architecture = capture('file', [executable])
if (!architecture.includes('arm64')) throw new Error(`Bundle non arm64: ${architecture}`)
const gatekeeper = run('spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath], [0, 3])
console.log(`[release] Gatekeeper status ${gatekeeper}: build provvisoria non notarizzata`)

const artifactNames = [
  `CerbonesPhoto-${version}-arm64.dmg`,
  `CerbonesPhoto-${version}-arm64-mac.zip`,
  'latest-mac.yml'
]
const checksums = {}
for (const name of artifactNames) checksums[name] = await sha256(join(project, 'dist', name))
const manifest = buildReleaseManifest(version, checksums)
const notesPath = join(project, 'dist/release-notes.md')
await writeFile(notesPath, manifest.notes, 'utf8')
for (const path of manifest.artifacts) console.log(`${checksums[basename(path)]}  ${path}`)

run('git', ['push', 'origin', 'main'])
const currentSha = capture('git', ['rev-parse', 'HEAD'])
run('gh', [
  'release', 'create', manifest.tag,
  '--repo', repository,
  '--target', currentSha,
  '--draft',
  '--generate-notes',
  '--notes-file', notesPath,
  '--title', `CerbonesPhoto ${version}`,
  ...manifest.artifacts
])
console.log(`[release] Bozza creata: https://github.com/${repository}/releases/tag/${manifest.tag}`)
