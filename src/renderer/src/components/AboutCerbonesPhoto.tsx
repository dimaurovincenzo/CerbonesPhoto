import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import iconUrl from '../../../../build/icon.png'
import type { PhotoEngineHealth } from '@shared/photo-types'
import { useAboutStore } from '../stores/about'
import { UpdateStatus } from './UpdateStatus'

export function AboutCerbonesPhoto(): React.JSX.Element | null {
  const isOpen = useAboutStore((state) => state.isOpen)
  const effect = useAboutStore((state) => state.effect)
  const message = useAboutStore((state) => state.message)
  const close = useAboutStore((state) => state.close)
  const activateLens = useAboutStore((state) => state.activateLens)
  const activateVersion = useAboutStore((state) => state.activateVersion)
  const recordKey = useAboutStore((state) => state.recordKey)
  const clearEffect = useAboutStore((state) => state.clearEffect)
  const [engines, setEngines] = useState<PhotoEngineHealth[]>([])
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    dialogRef.current?.focus()
    void window.cartelli.photo.engines().then(setEngines).catch(() => setEngines([]))
  }, [isOpen])

  useEffect(() => {
    if (!effect) return
    const timer = setTimeout(clearEffect, effect === 'polaroid' ? 500 : 320)
    return () => clearTimeout(timer)
  }, [effect, clearEffect])

  if (!isOpen) return null

  return (
    <div className="about-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div
        ref={dialogRef}
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close()
          else recordKey(event.key)
        }}
      >
        <button type="button" className="about-dialog__close" onClick={close} aria-label="Chiudi informazioni">×</button>
        <button type="button" className="about-dialog__lens" onClick={activateLens} aria-label="Obiettivo CerbonesPhoto">
          <img src={iconUrl} alt="" />
        </button>
        <h1 id="about-title">CerbonesPhoto</h1>
        <button
          type="button"
          className="about-dialog__version"
          onClick={(event) => activateVersion(event.altKey)}
          title="Versione dell’app"
        >
          Versione {window.cartelli.app.version}
        </button>
        <UpdateStatus />
        <p className="about-dialog__tagline">Catalogo fotografico privato. Originali sempre intatti.</p>

        <div className="about-engines" aria-label="Stato motori fotografici">
          {engines.length > 0 ? engines.map((engine) => (
            <span key={engine.name} className={engine.available ? 'is-ready' : 'is-unavailable'}>
              {engine.available ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {engine.name === 'libraw' ? 'LibRaw' : engine.name === 'exiftool' ? 'ExifTool' : 'Sharp'}
              {engine.version ? ` ${engine.version}` : ''}
            </span>
          )) : <span>Verifica motori…</span>}
        </div>

        <p className="about-dialog__signature">Powered by VDM with love — Cerbone Antonio</p>
        {message && <p className="about-dialog__joke" role="status">{message}</p>}

        {effect === 'shutter' && <div className="about-effect about-effect--shutter" aria-hidden="true" />}
        {effect === 'polaroid' && (
          <div className="about-effect about-effect--polaroid" aria-hidden="true">
            <img src={iconUrl} alt="" />
          </div>
        )}
      </div>
    </div>
  )
}
