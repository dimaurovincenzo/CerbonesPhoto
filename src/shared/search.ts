import { SEARCH_LEXICON } from './search-lexicon.ts'

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

for (const rawGroup of SEARCH_LEXICON) {
  const group = [...new Set(rawGroup.map(normalizeSearchText))].sort((a, b) => a.localeCompare(b, 'it'))
  for (const term of group) BY_TERM.set(term, group)
}

/** Ogni token produce un gruppo OR; i gruppi tra loro hanno semantica AND. */
export function expandSearchQuery(query: string): string[][] {
  const normalized = normalizeSearchText(query)
  if (!normalized) return []

  const tokens = normalized.split(' ')
  const seen = new Set<string>()
  const groups: string[][] = []
  for (let index = 0; index < tokens.length;) {
    let phrase = tokens[index]
    let consumed = 1
    // I nomi file usano spesso parole separate mentre la query contiene un
    // concetto composto: preferire sempre la frase lessicale più lunga.
    for (let end = tokens.length; end > index + 1; end--) {
      const candidate = tokens.slice(index, end).join(' ')
      if (BY_TERM.has(candidate)) {
        phrase = candidate
        consumed = end - index
        break
      }
    }
    const group = [...(BY_TERM.get(phrase) ?? [phrase])]
    const key = group.join('\u0000')
    if (!seen.has(key)) {
      seen.add(key)
      groups.push(group)
    }
    index += consumed
  }
  return groups
}

/** Restituisce 0 quando anche un solo concetto della query non è presente. */
export function scoreBilingualMatch(candidate: string, query: string): number {
  const value = normalizeSearchText(candidate)
  const groups = expandSearchQuery(query)
  if (!value || groups.length === 0) return 0
  const tokens = value.split(' ')
  const boundedValue = ` ${value} `

  let score = 0
  for (const alternatives of groups) {
    let best = 0
    for (const term of alternatives) {
      if (value === term) best = Math.max(best, 100)
      else if (tokens[0] === term) best = Math.max(best, 70)
      else if (tokens.includes(term)) best = Math.max(best, 50)
      else if (term.includes(' ') && boundedValue.includes(` ${term} `)) best = Math.max(best, 50)
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
