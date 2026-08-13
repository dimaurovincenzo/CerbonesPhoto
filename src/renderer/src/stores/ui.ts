import { create } from 'zustand'
import {
  clampLayoutSize,
  INSPECTOR_WIDTH,
  LABELS_HEIGHT,
  SIDEBAR_WIDTH
} from '@shared/layout'

interface UiState {
  inspectorVisible: boolean
  sidebarWidth: number
  inspectorWidth: number
  labelsHeight: number
  toggleInspector: () => void
  setSidebarWidth: (width: number) => void
  setInspectorWidth: (width: number) => void
  setLabelsHeight: (height: number) => void
  resetSidebarWidth: () => void
  resetInspectorWidth: () => void
  resetLabelsHeight: () => void
}

export const useUiStore = create<UiState>()((set) => ({
  inspectorVisible: true,
  sidebarWidth: SIDEBAR_WIDTH.default,
  inspectorWidth: INSPECTOR_WIDTH.default,
  labelsHeight: LABELS_HEIGHT.default,
  toggleInspector: () => set((state) => ({ inspectorVisible: !state.inspectorVisible })),
  setSidebarWidth: (width) => set({ sidebarWidth: clampLayoutSize(width, SIDEBAR_WIDTH) }),
  setInspectorWidth: (width) => set({ inspectorWidth: clampLayoutSize(width, INSPECTOR_WIDTH) }),
  setLabelsHeight: (height) => set({ labelsHeight: clampLayoutSize(height, LABELS_HEIGHT) }),
  resetSidebarWidth: () => set({ sidebarWidth: SIDEBAR_WIDTH.default }),
  resetInspectorWidth: () => set({ inspectorWidth: INSPECTOR_WIDTH.default }),
  resetLabelsHeight: () => set({ labelsHeight: LABELS_HEIGHT.default })
}))
