import assert from 'node:assert/strict'
import test from 'node:test'
import { reorderIds } from '../src/shared/reorder.ts'

test('riordina marker senza perdere elementi', () => {
  assert.deepEqual(reorderIds([1, 2, 3, 4], 4, 2), [1, 4, 2, 3])
  assert.deepEqual(reorderIds([1, 2, 3], 8, 2), [1, 2, 3])
})
