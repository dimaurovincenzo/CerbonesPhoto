import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePhotoMetadata } from '../src/main/photo/metadata-normalizer.ts'

test('normalizza EXIF IPTC e XMP in un contratto fotografico stabile', () => {
  const metadata = normalizePhotoMetadata({
    'EXIF:Make': 'Canon',
    'EXIF:Model': 'EOS R5',
    'EXIF:LensModel': 'RF24-70mm F2.8 L IS USM',
    'EXIF:DateTimeOriginal': '2026:08:13 18:42:10+02:00',
    'EXIF:ImageWidth': 8192,
    'EXIF:ImageHeight': 5464,
    'EXIF:Orientation': 6,
    'EXIF:ISO': 400,
    'EXIF:FNumber': 2.8,
    'EXIF:ExposureTime': '1/250',
    'EXIF:FocalLength': '50.0 mm',
    'ICC_Profile:ProfileDescription': 'Display P3',
    'IPTC:Keywords': ['famiglia'],
    'XMP:Subject': ['mare', 'famiglia']
  })

  assert.deepEqual(metadata, {
    cameraMake: 'Canon', cameraModel: 'EOS R5', lens: 'RF24-70mm F2.8 L IS USM',
    capturedAt: '2026-08-13T18:42:10+02:00', width: 8192, height: 5464,
    orientation: 6, iso: 400, aperture: 2.8, exposureSeconds: 0.004,
    focalLengthMm: 50, colorProfile: 'Display P3', keywords: ['famiglia', 'mare']
  })
})

test('gestisce metadata mancanti o malformati senza inventare valori', () => {
  assert.deepEqual(normalizePhotoMetadata({ 'EXIF:ExposureTime': 'non valido' }), {
    cameraMake: null, cameraModel: null, lens: null, capturedAt: null,
    width: null, height: null, orientation: null, iso: null, aperture: null,
    exposureSeconds: null, focalLengthMm: null, colorProfile: null, keywords: []
  })
})

test('usa UniqueCameraModel per i DNG senza tag Make e Model', () => {
  const metadata = normalizePhotoMetadata({ 'EXIF:UniqueCameraModel': 'Blackmagic Micro Cinema Camera' })

  assert.equal(metadata.cameraModel, 'Blackmagic Micro Cinema Camera')
})
