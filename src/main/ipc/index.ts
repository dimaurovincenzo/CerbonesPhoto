import { registerCategoriesIpc } from './categories'
import { registerDialogsIpc } from './dialogs'
import { registerFilesIpc } from './files'
import { registerFoldersIpc } from './folders'
import { registerSettingsIpc } from './settings'
import { registerTagsIpc } from './tags'
import { registerPhotoIpc } from './photo'
import type { PhotoRuntime } from '../photo/photo-runtime'
import type { UpdateRuntime } from '../updater/update-runtime'
import { registerUpdatesIpc } from './updates'

/** Registra tutti gli handler IPC del main process. Chiamare dopo l'apertura del DB. */
export function registerIpc(photoRuntime: PhotoRuntime, updateRuntime: UpdateRuntime): void {
  registerFoldersIpc(photoRuntime)
  registerFilesIpc()
  registerTagsIpc()
  registerCategoriesIpc()
  registerSettingsIpc()
  registerDialogsIpc()
  registerPhotoIpc(photoRuntime)
  registerUpdatesIpc(updateRuntime)
}
