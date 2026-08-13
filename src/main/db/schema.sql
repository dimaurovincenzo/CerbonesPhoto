-- Cartelli — schema SQLite (v1)
-- Le cartelle sono riferimenti al filesystem (path UNIQUE, nessun blob media).
-- Etichette ibride: categories (albero gerarchico) + tags (piatti colorati).

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------
-- Cartelle: gerarchia via parent_id. is_root = 1 per le root aggiunte
-- dall'utente; le sottocartelle scoperte dallo scanner hanno parent_id set.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id       INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  path            TEXT    NOT NULL UNIQUE,
  name            TEXT    NOT NULL,
  display_name    TEXT,
  is_root         INTEGER NOT NULL DEFAULT 0 CHECK (is_root IN (0,1)),
  color           TEXT,
  icon            TEXT,
  cover_path      TEXT,
  notes           TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  last_scanned_at INTEGER,
  file_count      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- ----------------------------------------------------------------------
-- File multimediali scoperti nelle cartelle (riferimenti al filesystem).
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id      INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  path           TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  kind           TEXT    NOT NULL CHECK (kind IN ('audio','image','video','other')),
  mime           TEXT,
  size_bytes     INTEGER,
  width          INTEGER,
  height         INTEGER,
  duration_ms    INTEGER,
  hash           TEXT,
  is_favorite    INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0,1)),
  metadata_json  TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

-- ----------------------------------------------------------------------
-- Categorie gerarchiche (albero libero, ogni categoria può avere figli).
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id   INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  color       TEXT,
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- ----------------------------------------------------------------------
-- Tag piatti colorati (stile macOS Finder). name UNIQUE case-insensitive.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  color       TEXT    NOT NULL DEFAULT '#8E8E93',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- ----------------------------------------------------------------------
-- Associazioni many-to-many.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folder_tags (
  folder_id  INTEGER NOT NULL REFERENCES folders(id)     ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES tags(id)        ON DELETE CASCADE,
  PRIMARY KEY (folder_id, tag_id)
);

CREATE TABLE IF NOT EXISTS folder_categories (
  folder_id    INTEGER NOT NULL REFERENCES folders(id)     ON DELETE CASCADE,
  category_id  INTEGER NOT NULL REFERENCES categories(id)  ON DELETE CASCADE,
  PRIMARY KEY (folder_id, category_id)
);

CREATE TABLE IF NOT EXISTS file_tags (
  file_id  INTEGER NOT NULL REFERENCES files(id)  ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
  PRIMARY KEY (file_id, tag_id)
);

-- ----------------------------------------------------------------------
-- Impostazioni app (key-value).
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT
);

-- ----------------------------------------------------------------------
-- Indici.
-- ----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_folders_parent         ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_files_folder           ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_kind             ON files(kind);
CREATE INDEX IF NOT EXISTS idx_folder_tags_tag        ON folder_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_folder_categories_cat  ON folder_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_tag          ON file_tags(tag_id);
