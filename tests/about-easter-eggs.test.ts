import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activateVersionEasterEgg,
  recordAboutKey,
  recordLensActivation,
  type AboutSequenceState
} from '../src/renderer/src/stores/about.ts'

test('attiva i tre easter egg solo con le sequenze approvate', () => {
  let lenses = { count: 0, effect: null as 'shutter' | null }
  for (let index = 0; index < 5; index++) lenses = recordLensActivation(lenses)
  assert.equal(lenses.effect, 'shutter')
  assert.equal(activateVersionEasterEgg(true).effect, 'version-joke')
  assert.equal(activateVersionEasterEgg(false).effect, null)

  let sequence: AboutSequenceState = { buffer: '', effect: null }
  for (const key of 'CERBONE') sequence = recordAboutKey(sequence, key)
  assert.equal(sequence.effect, 'polaroid')

  sequence = { buffer: '', effect: null }
  for (const key of 'CERBXONE') sequence = recordAboutKey(sequence, key)
  assert.equal(sequence.effect, null)
})
