import type { CartelliApi } from '@shared/api'

declare global {
  interface Window {
    cartelli: CartelliApi
  }
}
