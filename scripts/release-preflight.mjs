const EXPECTED_ORIGIN = 'https://github.com/dimaurovincenzo/CerbonesPhoto.git'
const STABLE_SEMVER = /^\d+\.\d+\.\d+$/
const SECRET_KEYS = ['GH_TOKEN', 'GITHUB_TOKEN', 'GITHUB_RELEASE_TOKEN', 'CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_APP_SPECIFIC_PASSWORD']

export function validateReleaseContext(context) {
  const errors = []
  if (context.platform !== 'darwin') errors.push('La release deve essere eseguita su macOS.')
  if (context.architecture !== 'arm64') errors.push('La release iniziale richiede architettura arm64.')
  if (context.branch !== 'main') errors.push('La release è consentita soltanto dal branch main.')
  if (context.status.trim()) errors.push('La worktree deve essere pulita prima della release.')
  if (!STABLE_SEMVER.test(context.packageVersion)) errors.push('La versione package deve essere SemVer stabile.')
  if (context.packageVersion !== context.lockVersion) errors.push('Le versioni di package.json e package-lock.json non coincidono.')
  if (context.origin !== EXPECTED_ORIGIN) errors.push(`Origin non valido: atteso ${EXPECTED_ORIGIN}.`)
  if (context.remoteTag.trim()) errors.push(`Il tag v${context.packageVersion} esiste già sul remote.`)
  return errors
}

export function findLiteralSecrets(files) {
  const findings = []
  const keyPattern = new RegExp(`^\\s*(${SECRET_KEYS.join('|')})\\s*[:=]\\s*(.+?)\\s*$`)
  for (const [path, content] of Object.entries(files)) {
    String(content).split(/\r?\n/).forEach((line, index) => {
      const match = keyPattern.exec(line)
      if (!match) return
      const value = match[2].replace(/^['"]|['"]$/g, '').trim()
      if (!value || value.startsWith('$') || value.includes('process.env') || value.includes('secrets.')) return
      findings.push(`${path}:${index + 1}:${match[1]}`)
    })
  }
  return findings.sort()
}

export function buildReleaseManifest(version, checksums) {
  const names = [
    `CerbonesPhoto-${version}-arm64.dmg`,
    `CerbonesPhoto-${version}-arm64-mac.zip`,
    'latest-mac.yml'
  ]
  for (const name of names) {
    if (!/^[a-f0-9]{64}$/.test(checksums[name] ?? '')) throw new Error(`Checksum non valido o assente per ${name}`)
  }
  const checksumLines = names.map((name) => `- \`${name}\`: \`${checksums[name]}\``).join('\n')
  return {
    tag: `v${version}`,
    artifacts: names.map((name) => `dist/${name}`),
    notes: `> **Build provvisoria non notarizzata** — al primo avvio macOS può richiedere un’autorizzazione manuale.\n\n## SHA-256\n\n${checksumLines}\n`
  }
}
