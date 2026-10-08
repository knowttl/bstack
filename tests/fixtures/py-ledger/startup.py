import argparse
import csv
import json
import sys
from decimal import Decimal
from pathlib import Path

from ledger import Ledger


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    book = Ledger()
    book.post("cash", "equity", Decimal("10"))
    csv.writer(sys.stdout).writerows(book.export_rows())
    args.output.write_text(json.dumps(book.export_rows()))


if __name__ == "__main__":
    main()
