import assert from 'node:assert/strict'
import test from 'node:test'
import {
  connectMediaSession,
  type MediaSessionAction,
  type MediaSessionPort
} from '../src/renderer/src/components/media-session.ts'

class FakeMediaSession implements MediaSessionPort {
  handlers = new Map<MediaSessionAction, (() => void) | null>()

  setActionHandler(action: MediaSessionAction, handler: (() => void) | null): void {
    this.handlers.set(action, handler)
  }

  trigger(action: MediaSessionAction): void {
    this.handlers.get(action)?.()
  }
}

test('il tasto multimediale successivo avanza la stessa coda del player', () => {
  const session = new FakeMediaSession()
  let currentIndex = 0
  const disconnect = connectMediaSession(session, {
    play: () => undefined,
    pause: () => undefined,
    next: () => { currentIndex += 1 },
    previous: () => undefined
  })

  session.trigger('nexttrack')
  assert.equal(currentIndex, 1)

  disconnect()
  session.trigger('nexttrack')
  assert.equal(currentIndex, 1)
})

test('i comandi multimediali play pausa e precedente mantengono la loro semantica', () => {
  const session = new FakeMediaSession()
  const actions: string[] = []
  connectMediaSession(session, {
    play: () => actions.push('play'),
    pause: () => actions.push('pause'),
    next: () => actions.push('next'),
    previous: () => actions.push('previous')
  })

  session.trigger('play')
  session.trigger('pause')
  session.trigger('previoustrack')

  assert.deepEqual(actions, ['play', 'pause', 'previous'])
})

test('un comando non supportato non impedisce di registrare gli altri', () => {
  const registered: MediaSessionAction[] = []
  const session: MediaSessionPort = {
    setActionHandler: (action) => {
      if (action === 'nexttrack') throw new Error('NotSupportedError')
      registered.push(action)
    }
  }

  assert.doesNotThrow(() => connectMediaSession(session, {
    play: () => undefined,
    pause: () => undefined,
    next: () => undefined,
    previous: () => undefined
  }))
  assert.deepEqual(registered, ['play', 'pause', 'previoustrack'])
})
