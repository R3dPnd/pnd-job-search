#!/usr/bin/env python3
"""Dev runner — mirrors dann-of-thursday/dann.py.
Usage: python pnd.py dev
"""
import os
import sys
import time
import signal
import subprocess
import threading
import urllib.request
import urllib.error

BACKEND_PORT = 8080
FRONTEND_PORT = 5173
HEALTH_URL = f"http://localhost:{BACKEND_PORT}/api/v1/health"

RESET = "\033[0m"
COLORS = {"backend": "\033[36m", "frontend": "\033[35m", "pnd": "\033[33m"}


def log(label: str, msg: str) -> None:
    color = COLORS.get(label, "")
    print(f"{color}[{label}]{RESET} {msg}", flush=True)


def stream(proc: subprocess.Popen, label: str) -> None:
    for line in iter(proc.stdout.readline, b""):
        log(label, line.decode(errors="replace").rstrip())


def wait_healthy(timeout: int = 30) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(HEALTH_URL, timeout=1)
            return True
        except Exception:
            time.sleep(0.3)
    return False


def wait_postgres(timeout: int = 30) -> bool:
    import socket
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("localhost", 5432), timeout=1):
                return True
        except OSError:
            time.sleep(0.5)
    return False


def dev() -> None:
    procs: list[subprocess.Popen] = []

    def shutdown(sig=None, frame=None):
        log("pnd", "shutting down…")
        for p in procs:
            try:
                p.terminate()
            except Exception:
                pass
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    root = os.path.dirname(os.path.abspath(__file__))

    # Copy .env if not present
    env_path = os.path.join(root, ".env")
    if not os.path.exists(env_path):
        example = os.path.join(root, ".env.example")
        if os.path.exists(example):
            import shutil
            shutil.copy(example, env_path)
            log("pnd", ".env created from .env.example — set ANTHROPIC_API_KEY")

    is_win = sys.platform == "win32"

    # Start postgres
    log("pnd", "starting postgres…")
    subprocess.run(
        ["docker", "compose", "up", "-d", "postgres"],
        cwd=root,
        shell=is_win,
        check=True,
    )
    if not wait_postgres(30):
        log("pnd", "postgres didn't become ready in 30s — check docker")
        shutdown()
    log("pnd", "postgres ready → localhost:5432")

    # Start backend
    log("pnd", f"starting backend on :{BACKEND_PORT}")
    backend_proc = subprocess.Popen(
        ["go", "run", "."],
        cwd=os.path.join(root, "backend"),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        shell=is_win,
    )
    procs.append(backend_proc)
    threading.Thread(target=stream, args=(backend_proc, "backend"), daemon=True).start()

    # Wait for backend health
    log("pnd", "waiting for backend…")
    if not wait_healthy(30):
        log("pnd", "backend didn't start in 30s — check errors above")
        shutdown()
    log("pnd", f"backend ready → http://localhost:{BACKEND_PORT}")

    # Start frontend
    log("pnd", f"starting frontend on :{FRONTEND_PORT}")
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=os.path.join(root, "frontend"),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        shell=is_win,
    )
    procs.append(frontend_proc)
    threading.Thread(target=stream, args=(frontend_proc, "frontend"), daemon=True).start()

    log("pnd", f"app → http://localhost:{FRONTEND_PORT}")

    # Keep alive
    for p in procs:
        p.wait()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "dev"
    if cmd == "dev":
        dev()
    else:
        print(f"unknown command: {cmd}")
        sys.exit(1)
