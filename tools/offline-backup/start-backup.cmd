@echo off
setlocal
set PYTHONDONTWRITEBYTECODE=1
start "" "%LocalAppData%\Programs\Python\Python313\pythonw.exe" "%~dp0backup_gui.pyw"
endlocal
