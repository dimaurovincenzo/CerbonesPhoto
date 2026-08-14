import type { MediaFile, SearchResult } from '@shared/types'

/** Mantiene l'ordine della ricerca quando una traccia viene avviata dai risultati. */
export function orderSearchAudioQueue(
  results: readonly SearchResult[],
  filesByFolder: ReadonlyMap<number, readonly MediaFile[]>
): MediaFile[] {
  return results
    .filter((result) => result.resultKind === 'file' && result.mediaKind === 'audio')
    .map((result) => filesByFolder.get(result.folderId)?.find((file) => file.id === result.id))
    .filter((file): file is MediaFile => file?.kind === 'audio')
}
