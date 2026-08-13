import { useEffect, useRef } from 'react'
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX
} from 'lucide-react'
import { usePlayerStore } from '@renderer/stores/player'
import type { MediaFile } from '@shared/types'
import { connectMediaSession, type MediaSessionPort } from './media-session'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function VolumeIcon({ volume }: { volume: number }): React.JSX.Element {
  if (volume <= 0) return <VolumeX size={15} />
  if (volume < 0.5) return <Volume1 size={15} />
  return <Volume2 size={15} />
}

/** Mini-player audio docked in basso, stile Now Playing di macOS. */
export function PlayerBar(): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const setAudioEl = usePlayerStore((s) => s.setAudioEl)

  const queue = usePlayerStore((s) => s.queue)
  const index = usePlayerStore((s) => s.index)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const volume = usePlayerStore((s) => s.volume)
  const speed = usePlayerStore((s) => s.speed)
  const playbackError = usePlayerStore((s) => s.playbackError)

  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const next = usePlayerStore((s) => s.next)
  const prev = usePlayerStore((s) => s.prev)
  const seek = usePlayerStore((s) => s.seek)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const setSpeed = usePlayerStore((s) => s.setSpeed)
  const onTimeUpdate = usePlayerStore((s) => s.onTimeUpdate)
  const onDurationChange = usePlayerStore((s) => s.onDurationChange)
  const onPlayPause = usePlayerStore((s) => s.onPlayPause)
  const onEnded = usePlayerStore((s) => s.onEnded)

  useEffect(() => {
    setAudioEl(audioRef.current)
    return () => setAudioEl(null)
  }, [setAudioEl])

  const current: MediaFile | undefined = index >= 0 ? queue[index] : undefined
  const hidden = !current

  useEffect(() => {
    if (!('mediaSession' in navigator)) return undefined

    const session: MediaSessionPort = {
      setActionHandler: (action, handler) => navigator.mediaSession.setActionHandler(action, handler)
    }
    return connectMediaSession(session, {
      play: () => {
        const player = usePlayerStore.getState()
        if (!player.isPlaying) player.togglePlay()
      },
      pause: () => {
        const player = usePlayerStore.getState()
        if (player.isPlaying) player.togglePlay()
      },
      next: () => usePlayerStore.getState().next(),
      previous: () => usePlayerStore.getState().prev()
    })
  }, [])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = current ? (isPlaying ? 'playing' : 'paused') : 'none'
    navigator.mediaSession.metadata = current
      ? new MediaMetadata({ title: current.name, album: 'CerbonesPhoto' })
      : null
  }, [current, isPlaying])

  return (
    <div className={`player-bar${hidden ? ' player-bar--hidden' : ''}`}>
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        onDurationChange={(e) => onDurationChange(e.currentTarget.duration)}
        onLoadedMetadata={(e) => onDurationChange(e.currentTarget.duration)}
        onPlay={() => onPlayPause(true)}
        onPause={() => onPlayPause(false)}
        onEnded={() => onEnded()}
      />

      {!hidden && current && (
        <>
          <div className="player-bar__info">
            <div className="player-bar__art">
              <Play size={16} />
            </div>
            <div className="player-bar__meta">
              <div className="player-bar__title" title={current.name}>
                {current.name}
              </div>
              <div className="player-bar__sub">
                {playbackError ?? `${index + 1} di ${queue.length} · ${fmtTime(duration)}`}
              </div>
            </div>
          </div>

          <div className="player-bar__center">
            <div className="player-bar__controls">
              <button className="icon-btn" onClick={prev} disabled={index <= 0} title="Precedente">
                <SkipBack size={16} />
              </button>
              <button
                className="player-bar__play"
                onClick={togglePlay}
                title={isPlaying ? 'Pausa' : 'Riproduci'}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                className="icon-btn"
                onClick={next}
                disabled={index >= queue.length - 1}
                title="Successiva"
              >
                <SkipForward size={16} />
              </button>
            </div>
            <div className="player-bar__seek">
              <span className="player-bar__time">{fmtTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="player-bar__slider"
              />
              <span className="player-bar__time">{fmtTime(duration)}</span>
            </div>
          </div>

          <div className="player-bar__right">
            <select
              className="player-bar__speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              title="Velocità"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s === 1 ? '1×' : `${s}×`}
                </option>
              ))}
            </select>
            <VolumeIcon volume={volume} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="player-bar__slider player-bar__slider--vol"
              title="Volume"
            />
          </div>
        </>
      )}
    </div>
  )
}
