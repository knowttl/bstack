from ledger import Ledger
from ledger._internal import amount


def opening_balance():
    book = Ledger()
    book.post("cash", "equity", amount("10"))
    return book.balance("cash")
