import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const project = process.cwd()
const libraw = join(project, 'resources/bin/darwin-arm64/simple_dcraw')
const exiftool = join(project, 'node_modules/exiftool-vendored.pl/bin/exiftool')
const requiredLicenses = [
  'resources/licenses/libraw/LICENSE.LGPL',
  'resources/licenses/libraw/LICENSE.CDDL',
  'resources/licenses/ExifTool.txt'
]

await access(libraw, constants.X_OK)
await access(exiftool, constants.X_OK)
for (const license of requiredLicenses) await access(join(project, license), constants.R_OK)

const architecture = spawnSync('file', [libraw], { encoding: 'utf8' })
if (architecture.status !== 0 || !architecture.stdout.includes('arm64')) {
  throw new Error(`LibRaw non è arm64: ${architecture.stdout || architecture.stderr}`)
}

const librawRun = spawnSync(libraw, [], { encoding: 'utf8' })
const librawOutput = `${librawRun.stdout}\n${librawRun.stderr}`
const librawVersion = /LibRaw\s+(0\.22\.2)/.exec(librawOutput)?.[1]
if (!librawVersion) throw new Error('Versione LibRaw attesa 0.22.2 non rilevata')

const exiftoolRun = spawnSync(exiftool, ['-ver'], { encoding: 'utf8' })
if (exiftoolRun.status !== 0 || !/^\d+\.\d+/m.test(exiftoolRun.stdout)) {
  throw new Error(`ExifTool non eseguibile: ${exiftoolRun.stderr}`)
}

const packageLock = JSON.parse(await readFile(join(project, 'package-lock.json'), 'utf8'))
const vendoredVersion = packageLock.packages?.['node_modules/exiftool-vendored']?.version
if (vendoredVersion !== '37.2.0') throw new Error(`exiftool-vendored non fissato: ${vendoredVersion ?? 'assente'}`)

const builder = await readFile(join(project, 'electron-builder.yml'), 'utf8')
for (const marker of ['minimumSystemVersion: \'12.0\'', 'extraResources:', 'darwin-arm64']) {
  if (!builder.includes(marker)) throw new Error(`Packaging fotografico incompleto: manca ${marker}`)
}

const hash = createHash('sha256').update(await readFile(libraw)).digest('hex')
if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Hash LibRaw non valido')

console.log(JSON.stringify({
  libraw: { version: librawVersion, architecture: 'arm64', sha256: hash },
  exiftool: { version: exiftoolRun.stdout.trim(), package: vendoredVersion },
  licenses: requiredLicenses
}, null, 2))
