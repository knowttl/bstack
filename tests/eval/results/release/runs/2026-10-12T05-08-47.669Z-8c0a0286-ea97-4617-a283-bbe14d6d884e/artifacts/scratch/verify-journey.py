import csv, io, json, pathlib, subprocess, sys
from decimal import Decimal
repo = pathlib.Path('[fixture]')
output = pathlib.Path(__file__).parent / 'journey-export.json'
result = subprocess.run([sys.executable, '-B', 'startup.py', str(output)], cwd=repo, capture_output=True, text=True)
assert result.returncode == 0, result.stderr
csv_rows = list(csv.reader(io.StringIO(result.stdout)))
json_rows = json.loads(output.read_text())
assert csv_rows == json_rows
assert len(json_rows) == 2
assert {row[0] for row in json_rows} == {'cash', 'equity'}
assert sum((Decimal(row[1]) - Decimal(row[2]) for row in json_rows), Decimal(0)) == 0
assert sum((Decimal(row[1]) for row in json_rows), Decimal(0)) > 0
sys.path.insert(0, str(repo))
from ledger import Ledger
book = Ledger()
book.import_rows(json_rows)
assert book.balanced()
assert book.balance('cash') > 0
assert book.balance('equity') == -book.balance('cash')
print('PASS: real Python CLI exports matching CSV/JSON balanced postings; public Ledger imports them and preserves balance')
