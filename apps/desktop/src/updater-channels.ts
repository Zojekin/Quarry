export const updaterChannels = {
  getState: 'quarry:updater:get-state',
  checkForUpdates: 'quarry:updater:check',
  downloadUpdate: 'quarry:updater:download',
  quitAndInstall: 'quarry:updater:install',
  setAutoUpdate: 'quarry:updater:set-auto-update',
  stateChange: 'quarry:updater:state-change',
} as const;
