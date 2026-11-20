# Windows Setup & Developer Guide

## Prerequisites
- **Operating System:** Windows 10 or 11
- **Python:** Python 3.11, 3.12, or 3.13 (Ensure "Add python.exe to PATH" was selected during install)
- **PowerShell:** Default Windows PowerShell / PowerShell 7

---

## 1. Quick-Start (3-Minute Setup)

### Step 1: Open PowerShell in the project root
```powershell
cd "c:\Users\SREENIDHI D V\OneDrive\Desktop\FOLDERS\INTERNSHIP, LEETCODE, CODING, PLACEMENT ETC\INTERNSHIP STUFF\HACKATHONS\TECH4BHARAT\succession"
```

### Step 2: Create and activate virtual environment (Optional if using global environment)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```
> **Note on PowerShell Execution Policy:** If you encounter `running scripts is disabled on this system`, run:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```
> Alternatively, execute Python scripts directly using `.\.venv\Scripts\python.exe`.

### Step 3: Install dependencies
```powershell
python -m pip install -r requirements.txt
```

### Step 4: Configure environment variables
```powershell
copy .env.example .env
```

### Step 5: Verify setup and environment health
```powershell
python scripts/verify_setup.py
```

### Step 6: Seed demo database with synthetic data
```powershell
python -m scripts.seed_demo
```

### Step 7: Run automated test suite
```powershell
python -m pytest -v
```

### Step 8: Start the backend server
```powershell
python -m uvicorn backend.app.main:app --reload --port 8000
```
- Interactive Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

## 2. Running the Advisory Agent

### Single Pass (Windows Task Scheduler compatible)
```powershell
python -m ai_engine.agent.run_once
```

### Persistent 15-Minute Scheduler
```powershell
python -m ai_engine.agent.scheduler
```
