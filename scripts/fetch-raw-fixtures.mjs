import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const API = 'https://raw.pixls.us/json/getrepository.php?set=all'
const LICENSE = 'CC0-1.0'
const FORMATS = ['CR2', 'CR3', 'NEF', 'ARW', 'RAF', 'ORF', 'RW2', 'DNG', 'PEF']
const destination = join(process.cwd(), 'tests', 'fixtures', 'raw')
const download = process.argv.includes('--download')

const response = await fetch(API)
if (!response.ok) throw new Error(`raw.pixls.us API: HTTP ${response.status}`)
const repository = await response.json()
const selections = FORMATS.map((format) => selectSmallest(repository.data, format))

if (!download) {
  console.log(JSON.stringify(selections, null, 2))
  process.exit(0)
}

await mkdir(join(destination, 'samples'), { recursive: true })
const manifest = []
for (const selection of selections) {
  if (!selection) throw new Error('La matrice raw.pixls.us non copre tutti i formati richiesti')
  const filename = safeFilename(selection)
  const relativeFile = join('samples', filename)
  const output = join(destination, relativeFile)
  const partial = `${output}.partial`
  const existingHash = await sha256File(output).catch(() => null)
  if (existingHash !== selection.sha256) {
    await rm(partial, { force: true })
    const rawResponse = await fetch(selection.sourceUrl)
    if (!rawResponse.ok || !rawResponse.body) throw new Error(`${selection.format}: HTTP ${rawResponse.status}`)
    await pipeline(Readable.fromWeb(rawResponse.body), createWriteStream(partial, { mode: 0o600 }))
    const actualHash = await sha256File(partial)
    if (actualHash !== selection.sha256) throw new Error(`${selection.format}: SHA-256 non valido`)
    await rename(partial, output)
  }
  manifest.push({
    file: relativeFile,
    sha256: selection.sha256,
    vendor: selection.vendor,
    cameraModel: selection.cameraModel,
    format: selection.format.toLowerCase(),
    sourceUrl: selection.sourceUrl,
    license: LICENSE,
    expectedOutcome: 'ready'
  })
  console.log(`${selection.format}: ${filename} (${selection.sizeBytes} byte)`)
}
await writeFile(join(destination, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`)

function selectSmallest(rows, format) {
  const suffix = new RegExp(`\\.${format}(?:<|')`, 'i')
  return rows
    .filter((row) => row[5].includes('Creative Commons 0') && suffix.test(row[7]))
    .map((row) => {
      const sourceUrl = row[7].match(/href='([^']+)'/)?.[1]
      const sha256 = row[7].match(/Checksum'>([a-f0-9]{64})/)?.[1]
      const sizeMatch = row[7].match(/\(([0-9.]+)(KB|MB|GB)\)/)
      const multiplier = sizeMatch?.[2] === 'GB' ? 1024 ** 3 : sizeMatch?.[2] === 'MB' ? 1024 ** 2 : 1024
      return {
        vendor: row[0],
        cameraModel: row[1],
        mode: row[2],
        format,
        sourceUrl,
        sha256,
        sizeBytes: Math.round(Number(sizeMatch?.[1] ?? Number.MAX_SAFE_INTEGER) * multiplier)
      }
    })
    .filter((entry) => entry.sourceUrl && entry.sha256)
    .sort((left, right) => left.sizeBytes - right.sizeBytes)[0] ?? null
}

function safeFilename(selection) {
  const stem = `${selection.vendor}-${selection.cameraModel}-${selection.mode}`
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90)
  return `${stem}.${selection.format.toLowerCase()}`
}

async function sha256File(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}
