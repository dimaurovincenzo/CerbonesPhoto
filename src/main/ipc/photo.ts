import { BrowserWindow, ipcMain } from 'electron'
import type { PhotoRuntime } from '../photo/photo-runtime'

export function registerPhotoIpc(runtime: PhotoRuntime): void {
  ipcMain.handle('photo:snapshot', () => runtime.pipeline.snapshot())
  ipcMain.handle('photo:pause', () => runtime.pipeline.pause())
  ipcMain.handle('photo:resume', () => runtime.pipeline.resume())
  ipcMain.handle('photo:retry', (_event, fileId: number) => {
    assertFileId(fileId)
    return runtime.pipeline.retry(fileId)
  })
  ipcMain.handle('photo:promoteVisible', (_event, fileIds: number[]) => {
    if (!Array.isArray(fileIds) || fileIds.length > 500 || fileIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      throw new Error('Elenco fotografie visibili non valido')
    }
    runtime.pipeline.promoteVisible(fileIds)
  })
  ipcMain.handle('photo:engines', () => runtime.engines())

  runtime.pipeline.onSnapshot((snapshot) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('photo:snapshot', snapshot)
    }
  })
}

function assertFileId(fileId: number): void {
  if (!Number.isSafeInteger(fileId) || fileId <= 0) throw new Error('File non valido')
}
