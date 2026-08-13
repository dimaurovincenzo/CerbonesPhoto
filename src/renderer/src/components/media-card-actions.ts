export type MediaCardActivation = 'select' | 'ignore'

/** Il secondo clic di una sequenza doppia non deve trasformarsi in apertura esterna. */
export function mediaCardActivation(clickCount: number): MediaCardActivation {
  return clickCount >= 2 ? 'ignore' : 'select'
}
