import { BrowserWindow, dialog, ipcMain } from 'electron'

/** Apre il dialog nativo macOS di selezione cartella. Ritorna il path o null. */
export function registerDialogsIpc(): void {
  ipcMain.handle('dialogs:pickDirectory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const options: Electron.OpenDialogOptions = {
      title: 'Aggiungi cartella',
      buttonLabel: 'Aggiungi',
      message: 'Seleziona una cartella da aggiungere a CerbonesPhoto',
      properties: ['openDirectory']
    }
    const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  ipcMain.handle('dialogs:confirmFolderRemoval', async (_event, rawName: string) => {
    const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim().slice(0, 120) : 'questa raccolta'
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Annulla', 'Rimuovi'],
      defaultId: 0,
      cancelId: 0,
      title: 'Rimuovi raccolta',
      message: `Rimuovere “${name}” da CerbonesPhoto?`,
      detail: 'I file originali sul Mac non verranno eliminati.'
    })
    return result.response === 1
  })

  ipcMain.handle('dialogs:confirmLabelRemoval', async (_event, rawKind: string, rawName: string) => {
    const kind = rawKind === 'categoria' ? 'categoria' : 'tag'
    const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim().slice(0, 120) : `questo ${kind}`
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Annulla', 'Elimina'],
      defaultId: 0,
      cancelId: 0,
      title: `Elimina ${kind}`,
      message: `Eliminare ${kind === 'categoria' ? 'la categoria' : 'il tag'} “${name}”?`,
      detail: kind === 'categoria'
        ? 'Saranno eliminate anche le sottocategorie. Le raccolte e i file non verranno modificati.'
        : 'Le assegnazioni verranno rimosse. Le raccolte e i file non verranno modificati.'
    })
    return result.response === 1
  })
}
