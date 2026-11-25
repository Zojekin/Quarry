import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import manifest from '../package.json';

const { nsis } = manifest.build;
const script = readFileSync(new URL(`../${nsis.include}`, import.meta.url), 'utf8');
const init = script.match(/!macro customInit\s+([\s\S]*?)!macroend/)?.[1];
const install = script.match(/!macro customInstall\s+([\s\S]*?)!macroend/)?.[1];
const installLines = install?.trim().split(/\r?\n/).map(line => line.trim()).join('\n');
const checked = '${BST_CHECKED}';

it('uses a Simplified Chinese assisted installer with the standard shortcut and uninstall settings', () => {
  expect(nsis).toMatchObject({
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    include: 'resources/installer.nsh',
    language: '2052',
    installerLanguages: ['zh_CN'],
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    deleteAppDataOnUninstall: false,
  });
  expect(script.trim()).toMatch(/^!ifndef BUILD_UNINSTALLER\s[\s\S]*\n!endif$/);
  expect(script).toMatch(/!macro customPageAfterChangeDir\s+Page custom QuarryShortcutOptions\b/);
  expect(script).toMatch(/\$\{If\} \$\{isUpdated\}\s+Abort\s+\$\{EndIf\}/);
});

it.each([
  ['Desktop', 'DESKTOP', '创建桌面快捷方式', 'addDesktopLink'],
  ['StartMenu', 'START_MENU', '创建开始菜单快捷方式', 'addStartMenuLink'],
] as const)('defaults the %s shortcut to checked and gates its creation on the selection', (name, define, label, macro) => {
  const variable = `$quarryCreate${name}`;
  const checkbox = `$quarry${name}Checkbox`;
  const guard = `DO_NOT_CREATE_${define}_SHORTCUT`;

  expect(script).toContain(`LangString Quarry${name}Option ${nsis.language} "${label}"`);
  expect(init).toContain(`StrCpy ${variable} ${checked}`);
  expect(script).toContain('${NSD_SetState} ' + `${checkbox} ${variable}`);
  expect(script).toContain('${NSD_OnClick} ' + `${checkbox} QuarrySaveShortcutOptions`);
  expect(script).toContain('${NSD_GetState} ' + `${checkbox} ${variable}`);
  expect(script).toContain(`!define ${guard}`);
  expect(install).toContain(`!undef ${guard}`);
  expect(installLines).toContain([
    '${If} ' + `${variable} == ${checked}`,
    `!insertmacro ${macro} $keepShortcuts`,
    '${EndIf}',
  ].join('\n'));
});
