import type { Category, Folder, MediaFile, MediaKind, Tag } from '@shared/types'

type Row = Record<string, unknown>

export function mapFolder(r: Row): Folder {
  return {
    id: r.id as number,
    parentId: (r.parent_id as number | null) ?? null,
    path: r.path as string,
    name: r.name as string,
    displayName: (r.display_name as string | null) ?? null,
    isRoot: Boolean(r.is_root),
    color: (r.color as string | null) ?? null,
    icon: (r.icon as string | null) ?? null,
    coverPath: (r.cover_path as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    sortOrder: r.sort_order as number,
    lastScannedAt: (r.last_scanned_at as number | null) ?? null,
    fileCount: r.file_count as number,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number
  }
}

export function mapTag(r: Row): Tag {
  return {
    id: r.id as number,
    name: r.name as string,
    color: r.color as string,
    sortOrder: (r.sort_order as number | undefined) ?? 0,
    createdAt: r.created_at as number
  }
}

export function mapCategory(r: Row): Category {
  return {
    id: r.id as number,
    parentId: (r.parent_id as number | null) ?? null,
    name: r.name as string,
    color: (r.color as string | null) ?? null,
    icon: (r.icon as string | null) ?? null,
    sortOrder: r.sort_order as number
  }
}

export function mapFile(r: Row): MediaFile {
  return {
    id: r.id as number,
    folderId: r.folder_id as number,
    path: r.path as string,
    name: r.name as string,
    kind: r.kind as MediaKind,
    mime: (r.mime as string | null) ?? null,
    sizeBytes: (r.size_bytes as number | null) ?? null,
    width: (r.width as number | null) ?? null,
    height: (r.height as number | null) ?? null,
    durationMs: (r.duration_ms as number | null) ?? null,
    hash: (r.hash as string | null) ?? null,
    isFavorite: Boolean(r.is_favorite),
    metadataJson: (r.metadata_json as string | null) ?? null,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number
  }
}
