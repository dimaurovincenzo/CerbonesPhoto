import assert from 'node:assert/strict'
import test from 'node:test'
import { clearAssignedIds, removeAssignedId } from '../src/renderer/src/components/label-assignment.ts'

test('rimuove una sola associazione senza eliminare gli altri marker', () => {
  assert.deepEqual(removeAssignedId([7, 3, 11], 3), [7, 11])
  assert.deepEqual(removeAssignedId([7, 3, 11], 99), [7, 3, 11])
})

test('rimuove tutte le associazioni con una lista vuota', () => {
  assert.deepEqual(clearAssignedIds(), [])
})
