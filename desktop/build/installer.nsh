!macro customInstall
  ; Remove the stale uninstall entry left by the pre-wasy.system.hesap desktop build.
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\841b3ff1-b53c-597c-aedb-a7f81bcb986b"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\841b3ff1-b53c-597c-aedb-a7f81bcb986b"
  DeleteRegKey HKLM "Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\841b3ff1-b53c-597c-aedb-a7f81bcb986b"
!macroend
