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
  assert.deepEqual(expandSearchQuery('mare'), [['mare', 'mari', 'ocean', 'oceans', 'sea', 'seas']])
  assert.deepEqual(expandSearchQuery('sea'), [['mare', 'mari', 'ocean', 'oceans', 'sea', 'seas']])
})

test('trova un filename inglese con una query italiana composta', () => {
  assert.ok(scoreBilingualMatch('Summer sea sunset.mov', 'mare tramonto') > 0)
  assert.equal(scoreBilingualMatch('Winter mountain.mov', 'mare tramonto'), 0)
  assert.equal(scoreBilingualMatch('seamless-search.ts', 'mare'), 0)
})

test('trova boat in un filename tecnico cercando barca', () => {
  assert.ok(scoreBilingualMatch('123_boat_23fs.mp3', 'barca') > 0)
  assert.ok(scoreBilingualMatch('holiday_boats_004.wav', 'barche') > 0)
  assert.equal(scoreBilingualMatch('boathouse.jpg', 'barca'), 0)
})

test('copre concetti comuni in entrambe le lingue senza rete', () => {
  const cases = [
    ['family_daughter_portrait.cr3', 'figlia ritratto'],
    ['red_car_in_forest.nef', 'auto rossa bosco'],
    ['birthday_cake_and_gifts.jpg', 'torta compleanno regali'],
    ['snowy_bridge_at_night.arw', 'ponte innevato notte'],
    ['birds_flying_over_lake.raf', 'uccelli lago'],
    ['wedding_dance_music.mp4', 'matrimonio ballo musica'],
    ['closeup_black_and_white.tiff', 'primo piano bianco nero'],
    ['raw_camera_archive.dng', 'fotocamera archivio raw']
  ] as const

  for (const [filename, query] of cases) {
    assert.ok(scoreBilingualMatch(filename, query) > 0, `${query} deve trovare ${filename}`)
  }
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
