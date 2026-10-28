@echo off
setlocal
cd /d "%~dp0"
title Gatefold Windows Installer Builder
echo.
echo =======================================================
echo    GATEFOLD - CREATE YOUR WINDOWS SETUP PROGRAM
echo =======================================================
echo.
echo This will download the necessary build software and create
echo Gatefold-Setup-1.1.1.exe in this folder.
echo.
echo Internet is required. It may download several hundred MB.
echo The setup program is not digitally signed.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Build-Windows.ps1"
set "result=%errorlevel%"
echo.
if not "%result%"=="0" (
 echo BUILD FAILED. Please see the error shown above.
 echo The script did not create a confirmed working installer.
) else (
 echo BUILD FINISHED.
 echo Open Gatefold-Setup-1.1.1.exe in this folder to install.
)
echo.
pause
exit /b %result%
