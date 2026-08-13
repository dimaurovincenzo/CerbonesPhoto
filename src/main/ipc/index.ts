import { registerCategoriesIpc } from './categories'
import { registerDialogsIpc } from './dialogs'
import { registerFilesIpc } from './files'
import { registerFoldersIpc } from './folders'
import { registerSettingsIpc } from './settings'
import { registerTagsIpc } from './tags'

/** Registra tutti gli handler IPC del main process. Chiamare dopo l'apertura del DB. */
export function registerIpc(): void {
  registerFoldersIpc()
  registerFilesIpc()
  registerTagsIpc()
  registerCategoriesIpc()
  registerSettingsIpc()
  registerDialogsIpc()
}
