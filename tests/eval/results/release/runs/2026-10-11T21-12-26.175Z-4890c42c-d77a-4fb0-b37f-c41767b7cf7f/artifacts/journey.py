import json, subprocess, sys
from decimal import Decimal
from pathlib import Path
from ledger import Ledger
path=Path(sys.argv[1])
result=subprocess.run([sys.executable, "-B", "startup.py", str(path)], capture_output=True, text=True, check=True)
rows=json.loads(path.read_text())
assert rows == [["cash","10.00","0",""],["equity","0","10.00",""]], rows
book=Ledger(); book.import_rows(rows)
assert book.balance("cash") == Decimal("10")
assert book.balance("equity") == Decimal("-10")
assert book.balanced()
assert [(a, Decimal(d), Decimal(c), m) for a,d,c,m in book.export_rows()] == [(a, Decimal(d), Decimal(c), m) for a,d,c,m in rows]
from app import opening_balance
assert opening_balance() == Decimal("10")
print(result.stdout, end="")
print("Startup JSON, public import/export, both balances and app opening balance passed")
