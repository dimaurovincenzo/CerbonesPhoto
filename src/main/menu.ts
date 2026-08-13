import { BrowserWindow, Menu, shell } from 'electron'

type MenuItem = Electron.MenuItemConstructorOptions

/**
 * Menu applicazione in stile macOS. Le azioni custom inviano un evento al
 * renderer via webContents.send('cartelli:menu-action', action).
 */
export function setupAppMenu(): void {
  const isMac = process.platform === 'darwin'

  const appItem: MenuItem[] = isMac ? [{
    label: 'CerbonesPhoto',
    submenu: [
      { label: 'Informazioni su CerbonesPhoto', click: () => sendAction('show-about') },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }] : []
  const closeOrQuit: MenuItem = isMac ? { role: 'close' } : { role: 'quit' }

  const template: MenuItem[] = [
    ...appItem,
    {
      label: 'File',
      submenu: [
        ...(!isMac ? [{ label: 'Informazioni su CerbonesPhoto', click: () => sendAction('show-about') } as MenuItem] : []),
        {
          label: 'Aggiungi cartella…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendAction('add-folder')
        },
        {
          label: 'Aggiorna raccolta',
          accelerator: 'CmdOrCtrl+R',
          click: () => sendAction('refresh-folder')
        },
        { type: 'separator' },
        closeOrQuit
      ]
    },
    { role: 'editMenu' },
    {
      role: 'viewMenu',
      submenu: [
        {
          label: 'Mostra o nascondi informazioni',
          accelerator: 'CmdOrCtrl+I',
          click: () => sendAction('toggle-inspector')
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'windowMenu',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }]
    },
    {
      label: 'Aiuto',
      submenu: [
        {
          label: 'Documentazione',
          click: () => void shell.openExternal('https://www.electronjs.org/docs/latest')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function sendAction(action: string): void {
  const win = BrowserWindow.getFocusedWindow()
  win?.webContents.send('cartelli:menu-action', action)
}
