; Diagnostics for packaging/install issues. The log is intentionally plain text
; so it can be collected even when the installed application cannot start.
!macro customInit
  ClearErrors
  FileOpen $9 "$TEMP\\Le Jean-Baptiste-installer.log" w
  FileWrite $9 "[installer] init"
  FileWriteByte $9 13
  FileWriteByte $9 10
  FileClose $9
!macroend

!macro customInstall
  FileOpen $9 "$TEMP\\Le Jean-Baptiste-installer.log" a
  FileWrite $9 "[installer] install-begin"
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
