import { BrowserWindow, ipcMain } from 'electron'
import type { UpdateRuntime } from '../updater/update-runtime'
import { connectUpdateIpc } from './update-router'

export function registerUpdatesIpc(runtime: UpdateRuntime): () => void {
  return connectUpdateIpc(runtime, {
    handle: (channel, handler) => { ipcMain.handle(channel, () => handler()) },
    send: (channel, snapshot) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send(channel, snapshot)
      }
    }
  })
}

