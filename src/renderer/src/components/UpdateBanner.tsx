import { CheckCircle2, Download } from 'lucide-react'
import { useState } from 'react'
import { updateBannerPresentation, useUpdatesStore } from '../stores/updates'

export function UpdateBanner(): React.JSX.Element | null {
  const snapshot = useUpdatesStore((state) => state.snapshot)
  const install = useUpdatesStore((state) => state.install)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)
  const presentation = updateBannerPresentation(snapshot)

  if (!presentation) return null
  if (presentation.status === 'downloaded' && dismissedVersion === snapshot.availableVersion) return null

  const percent = presentation.percent ?? 0
  return (
    <aside
      className={`update-banner update-banner--${presentation.status}`}
      role="status"
      aria-live="polite"
      aria-busy={!presentation.installable}
    >
      <span className="update-banner__icon" aria-hidden="true">
        {presentation.installable ? <CheckCircle2 size={17} /> : <Download size={17} />}
      </span>
      <span className="update-banner__copy">
        <strong>{presentation.label}</strong>
        <span>{presentation.installable ? 'Installazione pronta.' : 'Puoi continuare a usare il catalogo.'}</span>
      </span>
      {presentation.status === 'downloading' && (
        <span className="update-banner__percent">{percent}%</span>
      )}
      {presentation.installable && (
        <span className="update-banner__actions">
          <button type="button" className="update-banner__later" onClick={() => setDismissedVersion(snapshot.availableVersion)}>
            Più tardi
          </button>
          <button type="button" className="update-banner__install" onClick={() => void install()}>
            Installa e riavvia
          </button>
        </span>
      )}
      {!presentation.installable && presentation.percent != null && (
        <span
          className="update-banner__progress"
          role="progressbar"
          aria-label="Avanzamento aggiornamento"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ width: `${percent}%` }} />
        </span>
      )}
    </aside>
  )
}
