import log from 'electron-log'
import updaterModule from 'electron-updater'
import type { UpdaterPort } from '../../shared/update-types'
import { createElectronUpdatePort } from './electron-update-port'

export function createProductionUpdatePort(): UpdaterPort {
  return createElectronUpdatePort(updaterModule.autoUpdater, log)
}

