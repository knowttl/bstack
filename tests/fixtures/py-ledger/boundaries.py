import ast
import importlib.util
import json
from pathlib import Path

edges = {}
violations = set()
for path in [Path("app.py"), *sorted(Path("ledger").glob("*.py"))]:
    module = ".".join(path.with_suffix("").parts)
    if module.endswith(".__init__"):
        module = module.removesuffix(".__init__")
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
            targets.append(name)
            if module == "app" and name == "ledger._internal":
                violations.add("private")
            if module == "app" and name == "ledger.bridge":
                violations.add("alias")
    edges[module] = targets


def cycle(module, ancestors):
    if module in ancestors:
        return True
    return any(cycle(target, ancestors | {module}) for target in edges.get(module, []))


if any(cycle(module, set()) for module in edges):
    violations.add("cycle")
print(json.dumps(sorted(violations)))
raise SystemExit(1 if violations else 0)
