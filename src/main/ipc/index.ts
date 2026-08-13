import { registerCategoriesIpc } from './categories'
import { registerDialogsIpc } from './dialogs'
import { registerFilesIpc } from './files'
import { registerFoldersIpc } from './folders'
import { registerSettingsIpc } from './settings'
import { registerTagsIpc } from './tags'
import { registerPhotoIpc } from './photo'
import type { PhotoRuntime } from '../photo/photo-runtime'

/** Registra tutti gli handler IPC del main process. Chiamare dopo l'apertura del DB. */
export function registerIpc(photoRuntime: PhotoRuntime): void {
  registerFoldersIpc(photoRuntime)
  registerFilesIpc()
  registerTagsIpc()
  registerCategoriesIpc()
  registerSettingsIpc()
  registerDialogsIpc()
  registerPhotoIpc(photoRuntime)
}
