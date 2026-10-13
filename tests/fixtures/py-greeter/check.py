import subprocess
import sys

COMMANDS = [
    ["ruff", "check", "--no-cache", "."],
    ["ruff", "format", "--check", "--no-cache", "."],
    ["python3", "scripts/check-comments.py"],
]

for command in COMMANDS:
    result = subprocess.run(command, check=False)
    if result.returncode != 0:
        sys.exit(result.returncode)
