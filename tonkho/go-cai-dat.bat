@echo off
rem GKM Ton kho - go cai dat: tat chuong trinh va bo tu chay cung Windows
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\GKM Ton kho.lnk" 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*gkm-tonkho.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo  Da tat va go GKM Ton kho.
pause
