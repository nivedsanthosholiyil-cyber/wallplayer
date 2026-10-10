; Executable test of the production NSIS hooks. Uses only an isolated test key,
; writes no application files, and never changes the real Windows startup list.
Unicode true
RequestExecutionLevel user
SilentInstall silent
Name "Spontaneous startup hook test"
OutFile "${TEST_DIRECTORY}\startup-test.exe"
!include "LogicLib.nsh"
!define APP_EXECUTABLE_FILENAME "Spontaneous.exe"
!define SPONTANEOUS_RUN_KEY "${TEST_RUN_KEY}"
!define SPONTANEOUS_RUN_VALUE "TestApp"
Var TestUpdate
Var TestOutput
Var isForceCurrentInstall
!define isUpdated '"$TestUpdate" == "1"'
!include "${PROJECT_DIR}\build\installer.nsh"

!macro Check ACTUAL EXPECTED LABEL
  ${If} "${ACTUAL}" != "${EXPECTED}"
    FileWrite $TestOutput "FAIL: ${LABEL}$\r$\n"
    DeleteRegKey HKCU "${TEST_RUN_KEY}"
    FileClose $TestOutput
    SetErrorLevel 1
    Quit
  ${EndIf}
  FileWrite $TestOutput "PASS: ${LABEL}$\r$\n"
!macroend

Section
  SetRegView 64
  StrCpy $INSTDIR "$EXEDIR\app with spaces"
  StrCpy $TestUpdate "0"
  FileOpen $TestOutput "$EXEDIR\startup-test-result.txt" w
  !insertmacro customInstallMode
  !insertmacro Check $isForceCurrentInstall "1" "per-user installation"
  !insertmacro customInit
  !insertmacro Check $SpontaneousStartup ${BST_UNCHECKED} "fresh install opts out"
  !insertmacro customInstall
  ReadRegStr $R0 HKCU "${TEST_RUN_KEY}" "TestApp"
  !insertmacro Check $R0 "" "unchecked install creates no startup entry"

  StrCpy $SpontaneousStartup ${BST_CHECKED}
  !insertmacro customInstall
  ReadRegStr $R0 HKCU "${TEST_RUN_KEY}" "TestApp"
  StrCpy $R1 '$\"$INSTDIR\Spontaneous.exe$\" --wallpaper'
  !insertmacro Check $R0 $R1 "checked install writes quoted wallpaper command"
  !insertmacro customInit
  !insertmacro Check $SpontaneousStartup ${BST_CHECKED} "update preserves startup preference"

  StrCpy $TestUpdate "1"
  !insertmacro customUnInstall
  ReadRegStr $R0 HKCU "${TEST_RUN_KEY}" "TestApp"
  !insertmacro Check $R0 $R1 "update uninstaller retains startup entry"
  StrCpy $INSTDIR "$EXEDIR\updated path with spaces"
  !insertmacro customInstall
  ReadRegStr $R0 HKCU "${TEST_RUN_KEY}" "TestApp"
  StrCpy $R1 '$\"$INSTDIR\Spontaneous.exe$\" --wallpaper'
  !insertmacro Check $R0 $R1 "silent update refreshes installed executable path"

  StrCpy $SpontaneousStartup ${BST_UNCHECKED}
  !insertmacro customInstall
  ReadRegStr $R0 HKCU "${TEST_RUN_KEY}" "TestApp"
  !insertmacro Check $R0 "" "opting out removes startup entry"
  StrCpy $SpontaneousStartup ${BST_CHECKED}
  !insertmacro customInstall
  StrCpy $TestUpdate "0"
  !insertmacro customUnInstall
  ReadRegStr $R0 HKCU "${TEST_RUN_KEY}" "TestApp"
  !insertmacro Check $R0 "" "normal uninstall removes startup entry"

  DeleteRegKey HKCU "${TEST_RUN_KEY}"
  FileClose $TestOutput
  SetErrorLevel 0
SectionEnd
