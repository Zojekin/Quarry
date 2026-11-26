export type DesktopUpdateState = {
  currentVersion: string;
  autoUpdate: boolean;
  supported: boolean;
} & (
  | { status: 'idle' | 'checking' | 'up-to-date' }
  | { status: 'available' | 'downloaded'; version: string }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'error' }
);

export interface DesktopUpdaterBridge {
  getState(): Promise<DesktopUpdateState>;
  checkForUpdates(): Promise<void>;
  downloadUpdate(): Promise<void>;
  quitAndInstall(): Promise<void>;
  setAutoUpdate(enabled: boolean): Promise<void>;
  onStateChange(callback: (state: DesktopUpdateState) => void): () => void;
}
