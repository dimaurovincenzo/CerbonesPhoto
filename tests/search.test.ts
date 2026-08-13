import assert from 'node:assert/strict'
import test from 'node:test'
import {
  expandSearchQuery,
  normalizeSearchText,
  rankSearchCandidates,
  scoreBilingualMatch
} from '../src/shared/search.ts'

test('normalizza accenti, maiuscole e punteggiatura', () => {
  assert.equal(normalizeSearchText('  Caffè-d’ESTATE  '), 'caffe d estate')
})

test('espande una parola italiana e inglese nello stesso gruppo', () => {
  assert.deepEqual(expandSearchQuery('mare'), [['mare', 'sea']])
  assert.deepEqual(expandSearchQuery('sea'), [['mare', 'sea']])
})

test('trova un filename inglese con una query italiana composta', () => {
  assert.ok(scoreBilingualMatch('Summer sea sunset.mov', 'mare tramonto') > 0)
  assert.equal(scoreBilingualMatch('Winter mountain.mov', 'mare tramonto'), 0)
  assert.equal(scoreBilingualMatch('seamless-search.ts', 'mare'), 0)
})

test('mantiene la ricerca parziale per termini non tradotti', () => {
  assert.ok(scoreBilingualMatch('seamless-search.ts', 'seam') > 0)
})

test('una query vuota non genera termini né risultati', () => {
  assert.deepEqual(expandSearchQuery('   '), [])
  assert.equal(scoreBilingualMatch('sea.jpg', '   '), 0)
})

test('un percorso tecnico non influenza la corrispondenza sul nome', () => {
  const ranked = rankSearchCandidates([
    { id: 1, name: 'report.pdf', path: '/Users/demo/photos/report.pdf' },
    { id: 2, name: 'holiday-photo.jpg', path: '/Users/demo/docs/holiday-photo.jpg' }
  ], 'foto')

  assert.deepEqual(ranked.map((item) => item.id), [2])
})
