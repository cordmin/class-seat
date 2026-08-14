@echo off
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
python -m PyInstaller --clean 학급자리배치프로그램.spec
if exist "dist\학급자리배치프로그램.exe" copy /Y "dist\학급자리배치프로그램.exe" "..\자리배치 프로그램(EXE)(26.08.14)\학급자리배치프로그램.exe"
