!macro customInit
  ; During auto-update the previous Hesap.exe can stay hidden in the tray.
  ; Close only the app process before NSIS starts file replacement. Do not use /T:
  ; the updater installer can be a child process, and killing the whole tree can
  ; interrupt its own install flow.
  nsExec::ExecToLog 'taskkill /F /IM Hesap.exe'
  Sleep 1000
!macroend

!macro customInstall
  ; Remove the stale uninstall entry left by the pre-wasy.system.hesap desktop build.
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\841b3ff1-b53c-597c-aedb-a7f81bcb986b"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\841b3ff1-b53c-597c-aedb-a7f81bcb986b"
  DeleteRegKey HKLM "Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\841b3ff1-b53c-597c-aedb-a7f81bcb986b"
!macroend
