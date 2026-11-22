@echo off
rem GKM Ton kho - cai dat 1 lan: tu chay cung Windows va bat ngay bay gio
set "DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\GKM Ton kho.lnk'); $s.TargetPath='wscript.exe'; $s.Arguments='\"%DIR%chay-an.vbs\"'; $s.WorkingDirectory='%DIR%'; $s.Save()"
wscript.exe "%DIR%chay-an.vbs"
echo.
echo  Da cai xong GKM Ton kho. Chuong trinh dang chay an va se tu bat cung Windows.
echo  Quay lai app GKM, bam nut "Lay ton kho".
echo.
pause
