import ast
import importlib.util
from pathlib import Path

edges = {}
paths = {}
violations = []
for path in [Path("app.py"), *sorted(Path("ledger").glob("*.py"))]:
    module = ".".join(path.with_suffix("").parts)
    if module.endswith(".__init__"):
        module = module.removesuffix(".__init__")
    paths[module] = path.as_posix()
    targets = []
    for node in ast.walk(ast.parse(path.read_text())):
        names = []
        if isinstance(node, ast.ImportFrom):
            name = "." * node.level + (node.module or "")
            if node.level:
                name = importlib.util.resolve_name(name, "ledger")
            names = [f"{name}.{alias.name}" for alias in node.names] if node.module is None else [name]
        elif isinstance(node, ast.Import):
            names = [alias.name for alias in node.names]
        for name in names:
            spec = importlib.util.find_spec(name)
            if spec is None:
                raise ValueError(f"Unresolved import: {name}")
            targets.append((name, node.lineno))
            if module == "app" and name in ("ledger._internal", "ledger.bridge"):
                rule = "private-import" if name == "ledger._internal" else "alias-import"
                violations.append(
                    (path.as_posix(), node.lineno, rule, f"app imports ledger internals through {name}. Use ledger.Ledger.")
                )
    edges[module] = targets


def reaches(module, goal, seen):
    if module == goal:
        return True
    if module in seen:
        return False
    seen.add(module)
    return any(reaches(target, goal, seen) for target, _ in edges.get(module, []))


for module, targets in edges.items():
    for target, line in targets:
        if reaches(target, module, set()):
            violations.append(
                (paths[module], line, "dependency-cycle", f"this import of {target} leads back to {module}. Use a one-way dependency.")
            )
for path, line, rule, message in sorted(violations):
    print(f"{path}:{line}: {rule}: {message}")
raise SystemExit(1 if violations else 0)
