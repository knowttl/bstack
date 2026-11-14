import re
import sys
from pathlib import Path

FEATURE_ROOT = "app/features"
REGISTRY = "app/registry.py"
OUTSIDE_FEATURES = {"app/__init__.py", "app/main.py", REGISTRY, f"{FEATURE_ROOT}/__init__.py"}

source_files = sorted(path.as_posix() for path in Path("app").rglob("*.py"))
features = sorted(path.name for path in Path(FEATURE_ROOT).iterdir() if path.is_dir() and path.name != "__pycache__")
entries = ", ".join(f'"{name}": {name}' for name in features)
generated = f"from app.features import {', '.join(features)}\n\nFEATURES = {{{entries}}}\n"

if "--write" in sys.argv:
    Path(REGISTRY).write_text(generated)
else:
    diagnostics = [
        f"{file}:1: layout-convention: {file} is outside the feature folders. Use {FEATURE_ROOT}/<feature>/{Path(file).name}."
        for file in source_files
        if file not in OUTSIDE_FEATURES and not re.fullmatch(r"app/features/[^/]+/.+", file)
    ]
    if Path(REGISTRY).read_text() != generated:
        diagnostics.append(f"{REGISTRY}:1: registry-stale: {REGISTRY} does not match the folders under {FEATURE_ROOT}. Use python3 layout.py --write.")
    for diagnostic in diagnostics:
        print(diagnostic)
    sys.exit(1 if diagnostics else 0)
