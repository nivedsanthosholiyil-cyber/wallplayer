; Extend electron-builder's maintained installer, keeping its standard install,
; update and uninstall behavior. Startup is scoped to the installing Windows user.
!include "nsDialogs.nsh"
!include "MUI2.nsh"

!ifndef SPONTANEOUS_RUN_KEY
  !define SPONTANEOUS_RUN_KEY "Software\Microsoft\Windows\CurrentVersion\Run"
!endif
!ifndef SPONTANEOUS_RUN_VALUE
  !define SPONTANEOUS_RUN_VALUE "Spontaneous"
!endif

!ifndef BUILD_UNINSTALLER
  Var SpontaneousStartup
  Var SpontaneousStartupDialog
  Var SpontaneousStartupCheckbox

  !macro customInstallMode
    ; Per-user installs keep the user's startup choice independent of other users.
    StrCpy $isForceCurrentInstall "1"
  !macroend

  !macro customInit
    ; Fresh installs opt out. Silent updates retain the existing choice even
    ; though the options page is not shown. Interactive updates can change it.
    StrCpy $SpontaneousStartup ${BST_UNCHECKED}
    ReadRegStr $R0 HKCU "${SPONTANEOUS_RUN_KEY}" "${SPONTANEOUS_RUN_VALUE}"
    ${If} $R0 != ""
      StrCpy $SpontaneousStartup ${BST_CHECKED}
    ${EndIf}
  !macroend

  !macro customPageAfterChangeDir
    Page custom SpontaneousOptionsCreate SpontaneousOptionsLeave
  !macroend

  Function SpontaneousOptionsCreate
    !insertmacro MUI_HEADER_TEXT "Startup options" "Choose how Spontaneous opens on this computer."
    nsDialogs::Create 1018
    Pop $SpontaneousStartupDialog
    ${If} $SpontaneousStartupDialog == error
      Abort
    ${EndIf}
    ${NSD_CreateLabel} 0 0 100% 32u "Spontaneous can open as your live wallpaper automatically when you sign in to Windows."
    Pop $R0
    ${NSD_CreateCheckbox} 0 44u 100% 24u "Open Spontaneous when Windows starts"
    Pop $SpontaneousStartupCheckbox
    ${NSD_SetState} $SpontaneousStartupCheckbox $SpontaneousStartup
    ${NSD_CreateLabel} 0 80u 100% 44u "Optional. You can change this later in Windows Settings > Apps > Startup. It applies only to your Windows account."
    Pop $R0
    nsDialogs::Show
  FunctionEnd

  Function SpontaneousOptionsLeave
    ${NSD_GetState} $SpontaneousStartupCheckbox $SpontaneousStartup
  FunctionEnd

  !macro customInstall
    ${If} $SpontaneousStartup == ${BST_CHECKED}
      WriteRegStr HKCU "${SPONTANEOUS_RUN_KEY}" "${SPONTANEOUS_RUN_VALUE}" '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" --wallpaper'
    ${Else}
      DeleteRegValue HKCU "${SPONTANEOUS_RUN_KEY}" "${SPONTANEOUS_RUN_VALUE}"
    ${EndIf}
  !macroend
!endif

!macro customUnInstall
  ; electron-builder invokes the old uninstaller during an update. Keep the
  ; entry until the new installer refreshes its path; remove on actual uninstall.
  ${IfNot} ${isUpdated}
    DeleteRegValue HKCU "${SPONTANEOUS_RUN_KEY}" "${SPONTANEOUS_RUN_VALUE}"
  ${EndIf}
!macroend
