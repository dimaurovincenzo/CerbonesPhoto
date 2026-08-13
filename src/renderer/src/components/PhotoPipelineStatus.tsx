import { AlertTriangle, CheckCircle2, LoaderCircle, Pause, Play } from 'lucide-react'
import { usePhotoPipelineStore } from '../stores/photo-pipeline'

export function PhotoPipelineStatus(): React.JSX.Element {
  const snapshot = usePhotoPipelineStore((state) => state.snapshot)
  const pause = usePhotoPipelineStore((state) => state.pause)
  const resume = usePhotoPipelineStore((state) => state.resume)
  const active = snapshot.pending + snapshot.processing

  return (
    <div className="photo-pipeline-status" role="status" aria-live="polite">
      {snapshot.processing > 0 ? (
        <LoaderCircle className="is-spinning" size={13} aria-hidden="true" />
      ) : snapshot.failed + snapshot.partial > 0 ? (
        <AlertTriangle size={13} aria-hidden="true" />
      ) : (
        <CheckCircle2 size={13} aria-hidden="true" />
      )}
      <span className="photo-pipeline-status__label">
        {snapshot.processing > 0
          ? `${snapshot.processing} ${snapshot.processing === 1 ? 'foto in elaborazione' : 'foto in elaborazione'}`
          : active > 0
            ? `${snapshot.pending} in attesa`
            : snapshot.failed + snapshot.partial > 0
              ? `${snapshot.failed + snapshot.partial} da controllare`
              : 'Anteprime aggiornate'}
      </span>
      {(active > 0 || snapshot.paused) && (
        <button
          type="button"
          className="photo-pipeline-status__action"
          onClick={() => void (snapshot.paused ? resume() : pause())}
          aria-label={snapshot.paused ? 'Riprendi elaborazione foto' : 'Metti in pausa elaborazione foto'}
        >
          {snapshot.paused ? <Play size={11} fill="currentColor" /> : <Pause size={11} fill="currentColor" />}
          {snapshot.paused ? 'Riprendi' : 'Pausa'}
        </button>
      )}
    </div>
  )
}
