@echo off
chcp 65001 > nul
echo.
echo  ================================================
echo   사고 보고 시스템
echo  ================================================
echo.

:: 서버가 이미 실행 중인지 확인
netstat -ano | findstr ":3000" | findstr "LISTENING" > nul
if %errorlevel% == 0 (
    echo  [OK] 서버가 이미 실행 중입니다.
) else (
    echo  서버 시작 중...
    start /b "사고보고 서버" "C:\Program Files\nodejs\node.exe" "%~dp0server.js"
    timeout /t 2 /nobreak > nul
    echo  [OK] 서버가 시작됐습니다.
)

:: 터널이 이미 실행 중인지 확인
tasklist | findstr "cloudflared" > nul
if %errorlevel% == 0 (
    echo  [OK] 외부 터널이 이미 실행 중입니다.
) else (
    echo  외부 터널 시작 중...
    start /b "" "C:\Users\Administrator\cloudflared.exe" tunnel --url http://localhost:3000 > "%~dp0tunnel.log" 2>&1
    timeout /t 8 /nobreak > nul
)

:: 외부 URL 추출
set EXTERNAL_URL=
for /f "tokens=*" %%a in ('findstr "trycloudflare.com" "%~dp0tunnel.log" 2^>nul') do (
    for /f "tokens=5" %%b in ("%%a") do set EXTERNAL_URL=%%b
)

:: 내부 IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set LOCAL_IP=%%a
    goto :show
)

:show
setlocal enabledelayedexpansion
set LOCAL_IP=%LOCAL_IP: =%
echo.
echo  ================================================
echo   접속 주소
echo  ================================================
echo   [내부] http://%LOCAL_IP%:3000
if not "!EXTERNAL_URL!"=="" (
    echo   [외부] !EXTERNAL_URL!
) else (
    echo   [외부] tunnel.log 파일에서 확인하세요
)
echo  ================================================
echo.
pause
