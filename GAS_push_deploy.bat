@echo off
cd /d "%~dp0"

:MENU
cls
echo =========================================
echo   Spine CGH -- Dev Tools
echo =========================================
echo.
echo   1. GAS push + deploy
echo   2. Local development  (vue-app)
echo   3. Deploy to Cloudflare Pages  (build + publish)
echo   4. Exit
echo.
set /p CHOICE=Select [1-4]:

if "%CHOICE%"=="1" goto GAS_DEPLOY
if "%CHOICE%"=="2" goto LOCAL_DEV
if "%CHOICE%"=="3" goto NETLIFY_DEPLOY
if "%CHOICE%"=="4" goto END
echo Invalid option. Try again.
timeout /t 1 > nul
goto MENU

:: -----------------------------------------
:GAS_DEPLOY
cls
echo =========================================
echo   GAS push + deploy
echo =========================================
echo.

for /f "tokens=1-3 delims=/" %%a in ("%date%") do (
    set YY=%%a
    set MM=%%b
    set DD=%%c
)
for /f "tokens=1-2 delims=:" %%a in ("%time: =0%") do (
    set HH=%%a
    set MIN=%%b
)
set DESC=%YY%%MM%%DD%_%HH%%MIN%

echo [clasp push]
call clasp push --force
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] clasp push failed.
    echo Check: clasp installed? Logged in? .clasp.json exists?
    pause
    goto MENU
)

echo.
echo [clasp deploy]
call clasp deploy --deploymentId AKfycbxRZHwOH8LNA-SgYJUiDcG62cWfcdALQrH8fJYyFcbfR42T6u-up_xlPfsutZnUKam8Ng --description "%DESC%"
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] clasp deploy failed.
    pause
    goto MENU
)

echo.
echo [DONE] Push and deploy completed. (%DESC%)
pause
goto MENU

:: -----------------------------------------
:LOCAL_DEV
cls
echo =========================================
echo   Local development  (vue-app)
echo =========================================
echo.
echo Dev server will open in a new window.
echo Close that window to stop the server.
echo.
start "Vite Dev Server" cmd /k "cd /d "%~dp0vue-app" && npm run dev"
pause
goto MENU

:: -----------------------------------------
:NETLIFY_DEPLOY
cls
echo =========================================
echo   Deploy to Cloudflare Pages
echo =========================================
echo.

echo [1/2] Building vue-app...
cd /d "%~dp0vue-app"
npm run build
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] Build failed.
    cd /d "%~dp0"
    pause
    goto MENU
)

echo.
echo [2/2] Deploying to Cloudflare Pages...
cd /d "%~dp0"
wrangler pages deploy vue-app/dist --project-name spine-cgh --branch main
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] Deploy failed.
    echo Run "wrangler login" first if not authenticated.
    pause
    goto MENU
)

echo.
echo [DONE] Deployed to https://spine-cgh.pages.dev
pause
goto MENU

:: -----------------------------------------
:END
exit
