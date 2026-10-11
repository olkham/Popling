@echo off
rem Popling has no build step and no dependencies - "installing" just picks a
rem Python interpreter for the local dev server used by run.bat.
rem   install.bat          idempotent; keeps an existing choice
rem   install.bat --clean  forget the previous choice (and any .venv) and ask again
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "CHOICE_FILE=.python-bin"

if /i "%~1"=="--clean" (
  if exist .venv rmdir /s /q .venv
  if exist "%CHOICE_FILE%" del /q "%CHOICE_FILE%"
  echo Cleaned previous install.
) else if not "%~1"=="" (
  echo Usage: %~nx0 [--clean]
  exit /b 1
)

if exist "%CHOICE_FILE%" (
  set /p CHOSEN=<"%CHOICE_FILE%"
  where !CHOSEN! >nul 2>&1 && (
    echo Already installed - using !CHOSEN!.
    echo Run run.bat to start Popling.
    exit /b 0
  )
)

set COUNT=0
for %%P in (python3 python py) do (
  where %%P >nul 2>&1 && (
    %%P -c "import sys; sys.exit(sys.version_info < (3, 7))" >nul 2>&1 && (
      set /a COUNT+=1
      set "CAND!COUNT!=%%P"
    )
  )
)

if %COUNT%==0 (
  echo No Python 3.7+ found ^(tried python3, python and py^).
  echo Install Python, or skip it entirely with: docker compose up
  exit /b 1
)

if %COUNT%==1 (
  set "CHOSEN=!CAND1!"
) else (
  echo Found more than one Python interpreter:
  for /l %%I in (1,1,%COUNT%) do (
    for /f "delims=" %%V in ('!CAND%%I! --version 2^>^&1') do echo   %%I^) !CAND%%I!  ^(%%V^)
  )
  set "PICK=1"
  set /p "PICK=Which one should be used? [1]: "
  call set "CHOSEN=%%CAND!PICK!%%"
  if "!CHOSEN!"=="" (
    echo Invalid choice.
    exit /b 1
  )
)

>"%CHOICE_FILE%" echo !CHOSEN!
echo Installed - using !CHOSEN!.
echo Run run.bat to start Popling.
endlocal
