export type MediaSessionAction = 'play' | 'pause' | 'nexttrack' | 'previoustrack'

type MediaSessionHandler = () => void

export interface MediaSessionPort {
  setActionHandler: (action: MediaSessionAction, handler: MediaSessionHandler | null) => void
}

interface MediaSessionControls {
  play: MediaSessionHandler
  pause: MediaSessionHandler
  next: MediaSessionHandler
  previous: MediaSessionHandler
}

const ACTIONS: ReadonlyArray<readonly [MediaSessionAction, keyof MediaSessionControls]> = [
  ['play', 'play'],
  ['pause', 'pause'],
  ['nexttrack', 'next'],
  ['previoustrack', 'previous']
]

function setHandler(
  session: MediaSessionPort,
  action: MediaSessionAction,
  handler: MediaSessionHandler | null
): void {
  try {
    session.setActionHandler(action, handler)
  } catch {
    // Chromium può rifiutare singole azioni: le altre devono restare operative.
  }
}

/** Collega i tasti multimediali del sistema alle azioni già usate dal player. */
export function connectMediaSession(session: MediaSessionPort, controls: MediaSessionControls): () => void {
  for (const [action, control] of ACTIONS) setHandler(session, action, controls[control])

  return () => {
    for (const [action] of ACTIONS) setHandler(session, action, null)
  }
}
