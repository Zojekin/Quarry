!ifndef BUILD_UNINSTALLER
  !include "nsDialogs.nsh"

  Var quarryDesktopCheckbox
  Var quarryStartMenuCheckbox
  Var quarryCreateDesktop
  Var quarryCreateStartMenu

  !macro customHeader
    LangString QuarryShortcutTitle 2052 "快捷方式"
    LangString QuarryDesktopOption 2052 "创建桌面快捷方式"
    LangString QuarryStartMenuOption 2052 "创建开始菜单快捷方式"

    # Defer the template's shortcut macros to customInstall. Keep both enabled in the uninstaller.
    !define DO_NOT_CREATE_DESKTOP_SHORTCUT
    !define DO_NOT_CREATE_START_MENU_SHORTCUT
  !macroend

  !macro customInit
    StrCpy $quarryCreateDesktop ${BST_CHECKED}
    StrCpy $quarryCreateStartMenu ${BST_CHECKED}
  !macroend

  !macro customPageAfterChangeDir
    Page custom QuarryShortcutOptions

    Function QuarryShortcutOptions
      ${If} ${isUpdated}
        Abort
      ${EndIf}

      !insertmacro MUI_HEADER_TEXT "$(QuarryShortcutTitle)" ""
      nsDialogs::Create 1018
      Pop $0
      ${If} $0 == error
        Abort
      ${EndIf}

      ${NSD_CreateCheckbox} 0 8u 100% 12u "$(QuarryDesktopOption)"
      Pop $quarryDesktopCheckbox
      ${NSD_SetState} $quarryDesktopCheckbox $quarryCreateDesktop
      ${NSD_OnClick} $quarryDesktopCheckbox QuarrySaveShortcutOptions

      ${NSD_CreateCheckbox} 0 28u 100% 12u "$(QuarryStartMenuOption)"
      Pop $quarryStartMenuCheckbox
      ${NSD_SetState} $quarryStartMenuCheckbox $quarryCreateStartMenu
      ${NSD_OnClick} $quarryStartMenuCheckbox QuarrySaveShortcutOptions

      nsDialogs::Show
    FunctionEnd

    # Save each click so choices survive the Back button as well.
    Function QuarrySaveShortcutOptions
      Pop $0
      ${NSD_GetState} $quarryDesktopCheckbox $quarryCreateDesktop
      ${NSD_GetState} $quarryStartMenuCheckbox $quarryCreateStartMenu
    FunctionEnd
  !macroend

  !macro customInstall
    !undef DO_NOT_CREATE_DESKTOP_SHORTCUT
    !undef DO_NOT_CREATE_START_MENU_SHORTCUT

    ${If} $quarryCreateDesktop == ${BST_CHECKED}
      !insertmacro addDesktopLink $keepShortcuts
    ${EndIf}
    ${If} $quarryCreateStartMenu == ${BST_CHECKED}
      !insertmacro addStartMenuLink $keepShortcuts
    ${EndIf}

    # The template resolves the finish-page launch target before customInstall.
    ${If} ${FileExists} "$newStartMenuLink"
      StrCpy $launchLink "$newStartMenuLink"
    ${EndIf}
  !macroend
!endif
