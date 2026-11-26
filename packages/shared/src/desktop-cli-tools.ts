export type SkillPreset = 'claude' | 'codex' | 'gemini' | 'antigravity';

export interface DesktopCliToolsInfo {
  cli: { path: string; command: string } | null;
  targets: { id: SkillPreset; label: string; path: string }[];
}

export type SkillInstallResult =
  | { status: 'installed'; path: string }
  | { status: 'canceled' };

export interface DesktopCliToolsBridge {
  getInfo(): Promise<DesktopCliToolsInfo>;
  installSkill(target: SkillPreset | 'custom'): Promise<SkillInstallResult>;
}
