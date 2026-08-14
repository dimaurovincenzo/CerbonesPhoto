import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { CartelliApi } from '@shared/api'

/**
 * Implementazione dell'API esposta al renderer.
 * Ogni metodo è un thin wrapper attorno a ipcRenderer.invoke verso il main.
 * Nessun modulo Node è accessibile direttamente dal renderer.
 */
const api: CartelliApi = {
  app: {
    version: ipcRenderer.sendSync('app:getVersion') as string,
    platform: process.platform
  },
  folders: {
    listRoots: () => ipcRenderer.invoke('folders:listRoots'),
    listAll: () => ipcRenderer.invoke('folders:listAll'),
    labelIndex: () => ipcRenderer.invoke('folders:labelIndex'),
    get: (id) => ipcRenderer.invoke('folders:get', id),
    getChildren: (rootId) => ipcRenderer.invoke('folders:getChildren', rootId),
    addRoot: (input) => ipcRenderer.invoke('folders:addRoot', input),
    scan: (id) => ipcRenderer.invoke('folders:scan', id),
    update: (id, patch) => ipcRenderer.invoke('folders:update', id, patch),
    remove: (id) => ipcRenderer.invoke('folders:remove', id),
    getTags: (id) => ipcRenderer.invoke('folders:getTags', id),
    setTags: (id, tagIds) => ipcRenderer.invoke('folders:setTags', id, tagIds),
    getCategories: (id) => ipcRenderer.invoke('folders:getCategories', id),
    setCategories: (id, categoryIds) => ipcRenderer.invoke('folders:setCategories', id, categoryIds)
  },
  tags: {
    list: () => ipcRenderer.invoke('tags:list'),
    create: (input) => ipcRenderer.invoke('tags:create', input),
    update: (id, patch) => ipcRenderer.invoke('tags:update', id, patch),
    remove: (id) => ipcRenderer.invoke('tags:remove', id)
  },
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (input) => ipcRenderer.invoke('categories:create', input),
    update: (id, patch) => ipcRenderer.invoke('categories:update', id, patch),
    remove: (id) => ipcRenderer.invoke('categories:remove', id)
  },
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },
  files: {
    listByFolder: (folderId) => ipcRenderer.invoke('files:listByFolder', folderId),
    search: (query, limit) => ipcRenderer.invoke('files:search', query, limit),
    open: (fileId) => ipcRenderer.invoke('files:open', fileId),
    showInFinder: (fileId) => ipcRenderer.invoke('files:showInFinder', fileId),
    startDrag: (fileId) => ipcRenderer.send('files:startDrag', fileId)
  },
  dialogs: {
    pickDirectory: () => ipcRenderer.invoke('dialogs:pickDirectory'),
    confirmFolderRemoval: (name) => ipcRenderer.invoke('dialogs:confirmFolderRemoval', name),
    confirmLabelRemoval: (kind, name) => ipcRenderer.invoke('dialogs:confirmLabelRemoval', kind, name)
  },
  events: {
    onMenuAction: (cb) => {
      const handler = (_e: unknown, action: string): void => cb(action)
      ipcRenderer.on('cartelli:menu-action', handler)
      return () => ipcRenderer.removeListener('cartelli:menu-action', handler)
    }
  },
  photo: {
    snapshot: () => ipcRenderer.invoke('photo:snapshot'),
    pause: () => ipcRenderer.invoke('photo:pause'),
    resume: () => ipcRenderer.invoke('photo:resume'),
    retry: (fileId) => ipcRenderer.invoke('photo:retry', fileId),
    promoteVisible: (fileIds) => ipcRenderer.invoke('photo:promoteVisible', fileIds),
    engines: () => ipcRenderer.invoke('photo:engines'),
    onSnapshot: (callback) => {
      const handler = (_event: unknown, snapshot: Parameters<typeof callback>[0]): void => callback(snapshot)
      ipcRenderer.on('photo:snapshot', handler)
      return () => ipcRenderer.removeListener('photo:snapshot', handler)
    }
  },
  updates: {
    snapshot: () => ipcRenderer.invoke('updates:snapshot'),
    check: () => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.invoke('updates:install'),
    onSnapshot: (callback) => {
      const handler = (_event: unknown, snapshot: Parameters<typeof callback>[0]): void => callback(snapshot)
      ipcRenderer.on('updates:snapshot-event', handler)
      return () => ipcRenderer.removeListener('updates:snapshot-event', handler)
    }
  },
  web: {
    pathForFile: (file) => webUtils.getPathForFile(file)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('cartelli', api)
  } catch (error) {
    console.error('[preload] exposeInMainWorld failed:', error)
  }
} else {
  // @ts-ignore fallback quando contextIsolation è disattivato
  window.cartelli = api
}
