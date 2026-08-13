import { app } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'path'
import { mkdirSync } from 'fs'

/**
 * Singleton del database. Usa il modulo built-in `node:sqlite` (Node 24+):
 * nessuna dipendenza nativa da compilare o scaricare.
 *
 * Il file DB vive in userData (~/Library/Application Support/Cartelli/cartelli.db),
 * separato dal codice e dai dati dell'utente.
 */
let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (!db) throw new Error('DB non inizializzato — chiama openDb() dopo app.whenReady()')
  return db
}

export function openDb(): DatabaseSync {
  if (db) return db

  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })

  db = new DatabaseSync(join(dir, 'cartelli.db'))
  db.exec('PRAGMA foreign_keys = ON;')
  // WAL: lettori non bloccanti, migliori performance in scrittura.
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA synchronous = NORMAL;')

  return db
}

export function closeDb(): void {
  try {
    db?.close()
  } catch {
    // ignore — chiusura best-effort
  }
  db = null
}
