import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveSelectedFolderId,
  selectFolderCategoryIds,
  selectFolderTagIds
} from '../src/renderer/src/stores/selectors.ts'

test('riusa lo stesso array vuoto quando una cartella non ha tag', () => {
  const state = { folderTags: {} }

  const first = selectFolderTagIds(state, 42)
  const second = selectFolderTagIds(state, 42)

  assert.equal(first, second)
  assert.deepEqual(first, [])
})

test('riusa fallback stabili per tag e categorie', () => {
  const state = { folderTags: {}, folderCategories: {} }

  assert.equal(selectFolderTagIds(state, 9), selectFolderTagIds(state, 9))
  assert.equal(selectFolderCategoryIds(state, 9), selectFolderCategoryIds(state, 9))
})

test('restituisce i tag esistenti senza copiarli', () => {
  const tagIds = [2, 7]
  const state = { folderTags: { 42: tagIds } }

  assert.equal(selectFolderTagIds(state, 42), tagIds)
})

test('seleziona la prima root solo quando la selezione corrente non è valida', () => {
  const folders = [
    { id: 1, isRoot: true },
    { id: 2, isRoot: false }
  ]

  assert.equal(resolveSelectedFolderId(folders, null), 1)
  assert.equal(resolveSelectedFolderId(folders, 2), 2)
  assert.equal(resolveSelectedFolderId(folders, 99), 1)
  assert.equal(resolveSelectedFolderId([], 99), null)
})
