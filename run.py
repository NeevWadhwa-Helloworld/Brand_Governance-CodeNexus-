import os
import sys
import asyncio
import subprocess
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def main():
    print("=" * 70)
    print("Starting Intelligent Brand-Governance Platform")
    print("   Team: DoraAIemon | Problem Statement: Inkloom AI")
    print("=" * 70)

    # 1. Initialize DB and Seed Data
    print("\n[1/3] Initializing Database & Seed Knowledge Base...")
    try:
        from backend.seed_data import seed_database
        asyncio.run(seed_database())
        print("  OK Database initialized and seeded successfully.")
    except Exception as e:
        print(f"  ERROR initializing database: {e}")
        sys.exit(1)

    # 2. Start Backend Server (FastAPI on Port 8000)
    print("\n[2/3] Launching FastAPI Backend Server on http://127.0.0.1:8000 ...")
    backend_cmd = [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"]
    backend_proc = subprocess.Popen(backend_cmd, cwd=str(BASE_DIR))

    # Give backend a moment to start
    time.sleep(2)

    # 3. Start Frontend Server (Vite on Port 5173)
    print("\n[3/3] Launching Vite React Frontend on http://localhost:5173 ...")
    frontend_dir = BASE_DIR / "frontend"
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_proc = subprocess.Popen([npm_cmd, "run", "dev"], cwd=str(frontend_dir))

    print("\n" + "=" * 70)
    print("Intelligent Brand-Governance Platform is LIVE!")
    print("   Web Application UI: http://localhost:5173")
    print("   Backend API & Docs: http://127.0.0.1:8000/docs")
    print("   Health Status:       http://127.0.0.1:8000/api/health")
    print("=" * 70)
    print("Press Ctrl+C to stop all services.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down platform servers...")
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Done. Goodbye.")

if __name__ == "__main__":
    main()
