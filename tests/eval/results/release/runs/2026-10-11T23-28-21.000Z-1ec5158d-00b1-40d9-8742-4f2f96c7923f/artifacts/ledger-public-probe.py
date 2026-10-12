import csv, io, json, os, subprocess, sys
from decimal import Decimal
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))
from app import opening_balance
from ledger import Ledger
assert opening_balance() == Decimal("10"), "opening cash balance"
book = Ledger()
book.post("cash", "equity", "10")
assert book.balance("cash") == Decimal("10")
assert book.balance("equity") == Decimal("-10")
assert book.balanced()
for args in [("cash", "equity", "0"), ("cash", "equity", "-1"), ("cash", "cash", "1")]:
    before = book.export_rows()
    try:
        book.post(*args)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid post accepted")
    assert book.export_rows() == before, "rejection mutated ledger"
book.transfer("cash", "bank", "3")
book.reverse("cash", "equity", "2")
assert book.balanced()
clone = Ledger()
clone.import_rows(book.export_rows())
assert clone.entries() == book.entries(), "round trip preserves accounts, decimal amounts and memos"
assert clone.trial_balance() == book.trial_balance()
assert clone.balanced()
before = clone.export_rows()
try:
    clone.import_rows([("cash", "1", "0", "unbalanced")])
except ValueError:
    pass
else:
    raise AssertionError("unbalanced import accepted")
assert clone.export_rows() == before
output = Path(os.environ["TMPDIR"]) / "ledger-startup-output.json"
result = subprocess.run([sys.executable, "-B", "startup.py", str(output)], capture_output=True, text=True, check=True)
rows = json.loads(output.read_text())
assert list(csv.reader(io.StringIO(result.stdout))) == rows
assert [row[0] for row in rows] == ["cash", "equity"]
assert sum((Decimal(row[1])-Decimal(row[2]) for row in rows), Decimal(0)) == 0
assert Decimal(rows[0][1])-Decimal(rows[0][2]) == Decimal("10")
assert Decimal(rows[1][1])-Decimal(rows[1][2]) == Decimal("-10")
print("PASS: opening balance; balanced post/transfer/reverse; atomic rejection; public round trip; startup CSV/JSON")
