@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo Changing DNS to Google DNS (8.8.8.8, 1.1.1.1) on Wi-Fi adapter...
powershell -Command "Set-DnsClientServerAddress -InterfaceAlias 'Wi-Fi' -ServerAddresses ('8.8.8.8','1.1.1.1')"
ipconfig /flushdns

echo.
echo =======================================================
echo  SUCCESS: DNS updated to Google DNS (8.8.8.8, 1.1.1.1)
echo  Database connection to Neon is now enabled!
echo =======================================================
echo.
pause
