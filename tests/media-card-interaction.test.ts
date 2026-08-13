import assert from 'node:assert/strict'
import test from 'node:test'
import { mediaCardActivation } from '../src/renderer/src/components/media-card-actions.ts'

test('il doppio clic sulla card resta confinato nell’app', () => {
  assert.equal(mediaCardActivation(1), 'select')
  assert.equal(mediaCardActivation(2), 'ignore')
})
