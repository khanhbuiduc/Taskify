@echo off
echo ========================================
echo   Taskify - Starting All Services
echo ========================================
echo.

REM Chay Duckling trong cua so moi (port 8000)
echo [1/5] Starting Duckling...
start "Duckling" cmd /k "docker run --rm -p 8000:8000 rasa/duckling"

REM Cho Duckling khoi dong truoc
timeout /t 3 /nobreak > nul

REM Chay TaskifyAPI trong cua so moi (port 5001)
echo [2/5] Starting TaskifyAPI...
start "TaskifyAPI" cmd /k "cd TaskifyAPI && dotnet run"

REM Cho TaskifyAPI khoi dong truoc
timeout /t 3 /nobreak > nul

REM Chay Rasa Server trong cua so moi (port 5005)
echo [3/5] Starting Rasa Server...
start "Rasa Server" cmd /k "cd rasa && call venv\Scripts\activate && rasa run --enable-api --cors *"

REM Chay Rasa Action Server trong cua so moi (port 5055)
echo [4/5] Starting Rasa Action Server...
start "Rasa Actions" cmd /k "cd rasa && call venv\Scripts\activate && pip install -r actions/requirements.txt -q && rasa run actions"

REM Chay Frontend trong cua so moi (port 3000)
echo [5/5] Starting Frontend...
start "Taskify Frontend" cmd /k "cd taskifyView && npm run dev"

echo.
echo ========================================
echo   All services started!
echo ========================================
echo.
echo Services:
echo   - Duckling:      http://localhost:8000
echo   - TaskifyAPI:    http://localhost:5001
echo   - Rasa Server:   http://localhost:5005
echo   - Rasa Actions:  http://localhost:5055
echo   - Frontend:      http://localhost:3000
echo.
echo Note: If Rasa fails to start, make sure you have:
echo   1. Created venv in rasa folder: python -m venv venv
echo   2. Installed Rasa: pip install rasa
echo   3. Trained model: rasa train
echo   4. Docker is running (for Duckling)
echo.
pause
