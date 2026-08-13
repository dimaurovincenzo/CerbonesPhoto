import assert from 'node:assert/strict'
import test from 'node:test'
import { isRawPath, photoFormatFromPath } from '../src/shared/media-formats.ts'

test('classifica formati standard e RAW professionali', () => {
  for (const ext of ['jpg', 'png', 'tif', 'heic', 'webp', 'avif', 'bmp']) {
    assert.equal(photoFormatFromPath(`foto.${ext}`)?.family, 'standard', ext)
  }

  for (const ext of [
    'cr2', 'cr3', 'crw', 'nef', 'nrw', 'arw', 'sr2', 'srf', 'raf', 'orf', 'ori',
    'rw2', 'rwl', 'dng', 'pef', 'ptx', '3fr', 'fff', 'iiq', 'mef', 'mrw', 'x3f',
    'erf', 'dcr', 'kdc', 'srw'
  ]) {
    assert.equal(isRawPath(`foto.${ext}`), true, ext)
    assert.equal(photoFormatFromPath(`foto.${ext}`)?.family, 'raw', ext)
  }

  assert.equal(photoFormatFromPath('senza-estensione'), null)
  assert.equal(photoFormatFromPath('documento.pdf'), null)
})

test('associa produttore e MIME ai RAW principali', () => {
  assert.equal(photoFormatFromPath('ritratto.jpe')?.mime, 'image/jpeg')
  assert.deepEqual(photoFormatFromPath('IMG_0001.CR3'), {
    extension: 'cr3', mime: 'image/x-canon-cr3', family: 'raw', vendor: 'Canon'
  })
  assert.equal(photoFormatFromPath('DSC_1000.NEF')?.vendor, 'Nikon')
  assert.equal(photoFormatFromPath('DSC0001.ARW')?.vendor, 'Sony')
})
