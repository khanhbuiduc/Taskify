@echo off
echo ========================================
echo   Taskify - Starting All Services
echo ========================================
echo.

REM Chay TaskifyAPI trong cua so moi (port 5001)
echo [1/4] Starting TaskifyAPI...
start "TaskifyAPI" cmd /k "cd TaskifyAPI && dotnet run"

REM Cho TaskifyAPI khoi dong truoc
timeout /t 3 /nobreak > nul

REM Chay Rasa Server trong cua so moi (port 5005)
echo [2/4] Starting Rasa Server...
start "Rasa Server" cmd /k "cd rasa && call venv\Scripts\activate && rasa run --enable-api --cors *"

REM Chay Rasa Action Server trong cua so moi (port 5055)
echo [3/4] Starting Rasa Action Server...
start "Rasa Actions" cmd /k "cd rasa && call venv\Scripts\activate && pip install -r actions/requirements.txt -q && rasa run actions"

REM Chay Frontend trong cua so moi (port 3000)
echo [4/4] Starting Frontend...
start "Taskify Frontend" cmd /k "cd taskifyView && npm run dev"

echo.
echo ========================================
echo   All services started!
echo ========================================
echo.
echo Services:
echo   - TaskifyAPI:    http://localhost:5001
echo   - Rasa Server:   http://localhost:5005
echo   - Rasa Actions:  http://localhost:5055
echo   - Frontend:      http://localhost:3000
echo.
echo Note: If Rasa fails to start, make sure you have:
echo   1. Created venv in rasa folder: python -m venv venv
echo   2. Installed Rasa: pip install rasa
echo   3. Trained model: rasa train
echo.
pause
