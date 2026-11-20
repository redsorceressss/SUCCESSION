# PowerShell script to launch development server on Windows
Write-Host "Starting SUCCESSION Backend Dev Server..." -ForegroundColor Cyan

$env:PYTHONPATH = "."
python scripts/verify_setup.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "Setup verification failed. Please check errors above." -ForegroundColor Red
    exit 1
}

Write-Host "`nLaunching Uvicorn at http://127.0.0.1:8000 (OpenAPI docs at http://127.0.0.1:8000/docs)..." -ForegroundColor Green
python -m uvicorn backend.app.main:app --reload --port 8000
