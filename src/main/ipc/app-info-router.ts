export interface AppInfoIpcBridge {
  on: (channel: string, handler: () => string) => void
}

export function connectAppInfoIpc(version: string, bridge: AppInfoIpcBridge): void {
  bridge.on('app:getVersion', () => version)
}
