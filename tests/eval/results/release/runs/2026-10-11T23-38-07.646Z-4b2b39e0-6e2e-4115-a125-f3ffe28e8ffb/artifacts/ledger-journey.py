import csv, io, json, subprocess, sys
from decimal import Decimal
from pathlib import Path
from ledger import Ledger
from app import opening_balance
assert opening_balance() == Decimal("10")
book = Ledger()
book.post("cash", "equity", "10")
assert book.balance("cash") == Decimal("10")
assert book.balance("equity") == Decimal("-10")
assert book.balanced()
before = book.export_rows()
for args in [("cash", "equity", "-1"), ("cash", "equity", "0"), ("cash", "cash", "1")]:
    try:
        book.post(*args)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid posting accepted")
    assert book.export_rows() == before
    assert book.balanced()
output = Path(sys.argv[1])
run = subprocess.run([sys.executable, "-B", "startup.py", str(output)], capture_output=True, text=True, check=True)
expected = [["cash", "10.00", "0", ""], ["equity", "0", "10.00", ""]]
assert list(csv.reader(io.StringIO(run.stdout))) == expected
assert json.loads(output.read_text()) == expected
restored = Ledger()
restored.import_rows(json.loads(output.read_text()))
assert restored.balanced()
assert restored.balance("cash") == Decimal("10")
assert restored.balance("equity") == Decimal("-10")
print("PASS: public posting, rejection without mutation, app opening balance, startup CSV/JSON and public re-import")
