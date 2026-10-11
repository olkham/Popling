@echo off
rem Serve Popling locally at http://localhost:8000
rem   run.bat          default port 8000
rem   run.bat 9000     custom port
setlocal
cd /d "%~dp0"

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8000"

if not exist .python-bin (
  echo Not installed yet - running install.bat first.
  call install.bat || exit /b 1
)
set /p PY=<.python-bin

echo Popling running at http://localhost:%PORT%  (Ctrl+C to stop)
%PY% -m http.server %PORT% --bind 127.0.0.1
endlocal
