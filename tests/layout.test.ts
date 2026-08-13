import assert from 'node:assert/strict'
import test from 'node:test'
import { clampLayoutSize, SIDEBAR_WIDTH } from '../src/shared/layout.ts'

test('limita il ridimensionamento dei pannelli a misure utilizzabili', () => {
  assert.equal(clampLayoutSize(120, SIDEBAR_WIDTH), SIDEBAR_WIDTH.min)
  assert.equal(clampLayoutSize(290.4, SIDEBAR_WIDTH), 290)
  assert.equal(clampLayoutSize(900, SIDEBAR_WIDTH), SIDEBAR_WIDTH.max)
})
