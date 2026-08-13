import { app, ipcMain } from 'electron'
import { connectAppInfoIpc } from './app-info-router'

export function registerAppInfoIpc(): void {
  connectAppInfoIpc(app.getVersion(), {
    on: (channel, handler) => {
      ipcMain.on(channel, (event) => { event.returnValue = handler() })
    }
  })
}
