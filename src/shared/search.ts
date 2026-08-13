const LEXICON: readonly (readonly string[])[] = [
  ['mare', 'sea'],
  ['spiaggia', 'beach'],
  ['montagna', 'mountain'],
  ['tramonto', 'sunset'],
  ['alba', 'sunrise'],
  ['estate', 'summer'],
  ['inverno', 'winter'],
  ['primavera', 'spring'],
  ['autunno', 'autumn', 'fall'],
  ['viaggio', 'travel', 'trip'],
  ['vacanza', 'holiday', 'vacation'],
  ['famiglia', 'family'],
  ['amici', 'friends'],
  ['bambino', 'bambini', 'child', 'children', 'kid', 'kids'],
  ['compleanno', 'birthday'],
  ['matrimonio', 'wedding'],
  ['festa', 'party'],
  ['casa', 'home', 'house'],
  ['lavoro', 'work'],
  ['musica', 'music'],
  ['canzone', 'song'],
  ['registrazione', 'recording'],
  ['voce', 'voice'],
  ['foto', 'fotografia', 'photo', 'picture', 'image'],
  ['video', 'filmato', 'movie', 'clip'],
  ['documento', 'document'],
  ['preferito', 'preferiti', 'favorite', 'favorites'],
  ['nuovo', 'new'],
  ['vecchio', 'old'],
  ['gatto', 'cat'],
  ['cane', 'dog'],
  ['citta', 'city'],
  ['notte', 'night'],
  ['giorno', 'day']
]

const BY_TERM = new Map<string, readonly string[]>()

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it-IT')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

for (const rawGroup of LEXICON) {
  const group = [...new Set(rawGroup.map(normalizeSearchText))].sort((a, b) => a.localeCompare(b, 'it'))
  for (const term of group) BY_TERM.set(term, group)
}

/** Ogni token produce un gruppo OR; i gruppi tra loro hanno semantica AND. */
export function expandSearchQuery(query: string): string[][] {
  const normalized = normalizeSearchText(query)
  if (!normalized) return []

  const seen = new Set<string>()
  const groups: string[][] = []
  for (const token of normalized.split(' ')) {
    const group = [...(BY_TERM.get(token) ?? [token])]
    const key = group.join('\u0000')
    if (!seen.has(key)) {
      seen.add(key)
      groups.push(group)
    }
  }
  return groups
}

/** Restituisce 0 quando anche un solo concetto della query non è presente. */
export function scoreBilingualMatch(candidate: string, query: string): number {
  const value = normalizeSearchText(candidate)
  const groups = expandSearchQuery(query)
  if (!value || groups.length === 0) return 0
  const tokens = value.split(' ')

  let score = 0
  for (const alternatives of groups) {
    let best = 0
    for (const term of alternatives) {
      if (value === term) best = Math.max(best, 100)
      else if (tokens[0] === term) best = Math.max(best, 70)
      else if (tokens.includes(term)) best = Math.max(best, 50)
      // Un concetto tradotto deve coincidere con una parola intera: così
      // `mare`/`sea` non intercetta nomi tecnici come `seamless`.
      else if (alternatives.length === 1 && tokens.some((token) => token.startsWith(term))) {
        best = Math.max(best, 30)
      } else if (alternatives.length === 1 && value.includes(term)) {
        best = Math.max(best, 20)
      }
    }
    if (best === 0) return 0
    score += best
  }
  return score
}

export function rankSearchCandidates<T extends { name: string }>(
  candidates: readonly T[],
  query: string
): Array<T & { score: number }> {
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreBilingualMatch(candidate.name, query) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'it'))
}
