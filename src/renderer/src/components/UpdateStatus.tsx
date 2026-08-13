import { CheckCircle2, Download, RefreshCw } from 'lucide-react'
import { updatePresentation, useUpdatesStore } from '../stores/updates'

export function UpdateStatus(): React.JSX.Element {
  const snapshot = useUpdatesStore((state) => state.snapshot)
  const check = useUpdatesStore((state) => state.check)
  const install = useUpdatesStore((state) => state.install)
  const presentation = updatePresentation(snapshot)

  const icon = snapshot.status === 'downloaded'
    ? <Download size={13} aria-hidden="true" />
    : snapshot.status === 'up-to-date'
      ? <CheckCircle2 size={13} aria-hidden="true" />
      : <RefreshCw size={13} className={presentation.busy ? 'is-spinning' : ''} aria-hidden="true" />

  return (
    <div className="update-status" role="status" aria-live="polite" aria-busy={presentation.busy}>
      <span className="update-status__label">{icon}{presentation.label}</span>
      {presentation.action === 'check' && (
        <button type="button" className="update-status__action" onClick={() => void check()}>
          {snapshot.status === 'error' ? 'Riprova' : 'Controlla'}
        </button>
      )}
      {presentation.action === 'install' && (
        <button type="button" className="update-status__install" onClick={() => void install()}>
          Installa e riavvia
        </button>
      )}
      {snapshot.status === 'downloading' && (
        <span className="update-status__progress" aria-hidden="true">
          <span style={{ width: `${snapshot.percent ?? 0}%` }} />
        </span>
      )}
    </div>
  )
}

