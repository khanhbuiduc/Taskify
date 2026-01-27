@echo off

REM Chạy taskifyAPI trong cửa sổ mới
start cmd /k "cd taskifyAPI && dotnet run"

REM Chạy taskifyView trong cửa sổ mới
start cmd /k "cd taskifyView && npm run dev"

REM Nếu taskifyView là frontend (React/Vue/Angular), thay dotnet run bằng npm start hoặc lệnh tương ứng
REM start cmd /k "cd taskifyView && npm start"

echo Đã khởi động cả taskifyAPI và taskifyView.
pause
