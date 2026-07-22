; Diagnostics + ARM64 per-machine install path fix.
; The log is intentionally plain text so it can be collected even when the
; installed application cannot start.
;
; electron-builder's multiUser.nsh only switches $INSTDIR to $PROGRAMFILES64
; when APP_64 is defined. ARM64-only builds therefore default to the 32-bit
; NSIS $PROGRAMFILES (= "Program Files (x86)"), so a user looking in
; "C:\Program Files" sees nothing. Force the real Program Files for ARM64-only.

!macro customInit
  ClearErrors
  FileOpen $9 "$TEMP\\Le Jean-Baptiste-installer.log" w
  FileWrite $9 "[installer] init"
  FileWriteByte $9 13
  FileWriteByte $9 10
  !ifdef APP_ARM64
    !ifndef APP_64
      FileWrite $9 "[installer] arch=arm64-only"
      FileWriteByte $9 13
      FileWriteByte $9 10
      ; Prefer native Program Files when install mode is per-machine.
      ${If} $installMode == "all"
        StrCpy $INSTDIR "$PROGRAMFILES64\${APP_FILENAME}"
        FileWrite $9 "[installer] instdir-forced-programfiles64=$INSTDIR"
        FileWriteByte $9 13
        FileWriteByte $9 10
      ${EndIf}
    !endif
  !endif
  FileClose $9
!macroend

!macro customInstall
  FileOpen $9 "$TEMP\\Le Jean-Baptiste-installer.log" a
  FileWrite $9 "[installer] install-begin"
  FileWriteByte $9 13
  FileWriteByte $9 10
  FileWrite $9 "[installer] instdir=$INSTDIR"
  FileWriteByte $9 13
  FileWriteByte $9 10
  IfFileExists "$INSTDIR\\Le Jean-Baptiste.exe" app_present app_missing
app_present:
  FileWrite $9 "[installer] app-exe=present"
  FileWriteByte $9 13
  FileWriteByte $9 10
  DetailPrint "Application executable found: $INSTDIR\\Le Jean-Baptiste.exe"
  Goto app_check_done
app_missing:
  FileWrite $9 "[installer] app-exe=MISSING"
  FileWriteByte $9 13
  FileWriteByte $9 10
  DetailPrint "WARNING: application executable missing: $INSTDIR\\Le Jean-Baptiste.exe"
  MessageBox MB_OK|MB_ICONEXCLAMATION "Installation finished but Le Jean-Baptiste.exe was not found in:$\r$\n$INSTDIR$\r$\n$\r$\nPlease send %TEMP%\Le Jean-Baptiste-installer.log to the developers."
app_check_done:
  FileWrite $9 "[installer] install-end"
  FileWriteByte $9 13
  FileWriteByte $9 10
  FileClose $9
  CopyFiles /SILENT "$TEMP\\Le Jean-Baptiste-installer.log" "$INSTDIR\\Le Jean-Baptiste-installer.log"
!macroend

!macro customUnInstall
  Delete "$INSTDIR\\Le Jean-Baptiste-installer.log"
!macroend
