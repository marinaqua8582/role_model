@echo off
setlocal
set PYTHONDONTWRITEBYTECODE=1
start "" "%LocalAppData%\Programs\Python\Python313\pythonw.exe" "%~dp0final-cutover.pyw"
endlocal
