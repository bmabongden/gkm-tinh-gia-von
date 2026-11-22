@echo off
rem GKM Tinh gia von - tao bieu tuong tren man hinh Desktop (bam dup de mo app)
set "DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$n='GKM T'+[char]0x00ED+'nh gi'+[char]0x00E1+' v'+[char]0x1ED1+'n'; $s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\'+$n+'.lnk'); $s.TargetPath='%DIR%index.html'; $s.WorkingDirectory='%DIR%'; $s.IconLocation='%DIR%gkm.ico,0'; $s.Description=$n; $s.Save()"
echo.
echo  Da tao bieu tuong "GKM Tinh gia von" tren man hinh Desktop.
echo  Tu nay bam dup bieu tuong do de mo app.
echo.
pause
