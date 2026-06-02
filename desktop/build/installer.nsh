!macro customInit
  ; During auto-update the previous Hesap.exe can stay hidden in the tray.
  ; Close it before NSIS starts file replacement so the installer does not get stuck.
  nsExec::ExecToLog 'taskkill /F /T /IM Hesap.exe'
!macroend

!macro customInstall
  ; Remove the stale uninstall entry left by the pre-wasy.system.hesap desktop build.
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\841b3ff1-b53c-597c-aedb-a7f81bcb986b"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\841b3ff1-b53c-597c-aedb-a7f81bcb986b"
  DeleteRegKey HKLM "Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\841b3ff1-b53c-597c-aedb-a7f81bcb986b"
!macroend
