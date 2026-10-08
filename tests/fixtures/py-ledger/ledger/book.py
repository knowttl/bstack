from dataclasses import dataclass
from decimal import Decimal

from ._internal import amount


@dataclass(frozen=True)
class Entry:
    account: str
    debit: Decimal
    credit: Decimal
    memo: str


class Ledger:
    """Own entries, balance calculations and balanced posting as one concept."""

    def __init__(self):
        self._entries = []

    def post(self, debit_account, credit_account, value, memo=""):
        value = amount(value)
        if value <= 0:
            raise ValueError("A posting must be positive")
        if debit_account == credit_account:
            raise ValueError("Posting accounts must differ")
        self._entries.extend([
            Entry(debit_account, value, Decimal(0), memo),
            Entry(credit_account, Decimal(0), value, memo),
        ])

    def balance(self, account):
        return sum(
            (entry.debit - entry.credit for entry in self._entries
             if entry.account == account),
            Decimal(0),
        )

    def entries(self, account=None):
        return tuple(
            entry for entry in self._entries
            if account is None or entry.account == account
        )

    def accounts(self):
        return tuple(sorted({entry.account for entry in self._entries}))

    def trial_balance(self):
        return {account: self.balance(account) for account in self.accounts()}

    def balanced(self):
        return sum(self.trial_balance().values(), Decimal(0)) == 0

    def statement(self, account):
        balance = Decimal(0)
        rows = []
        for entry in self.entries(account):
            balance += entry.debit - entry.credit
            rows.append((entry.memo, entry.debit, entry.credit, balance))
        return tuple(rows)

    def transfer(self, source, destination, value, memo=""):
        self.post(destination, source, value, memo)

    def reverse(self, debit_account, credit_account, value, memo=""):
        self.post(credit_account, debit_account, value, memo)

    def totals(self, account):
        entries = self.entries(account)
        return (
            sum((entry.debit for entry in entries), Decimal(0)),
            sum((entry.credit for entry in entries), Decimal(0)),
        )

    def export_rows(self):
        return tuple(
            (entry.account, str(entry.debit), str(entry.credit), entry.memo)
            for entry in self._entries
        )

    def import_rows(self, rows):
        entries = []
        for account, debit, credit, memo in rows:
            debit, credit = amount(debit), amount(credit)
            if debit < 0 or credit < 0 or (debit and credit):
                raise ValueError("Invalid entry")
            entries.append(Entry(account, debit, credit, memo))
        if sum((entry.debit - entry.credit for entry in entries), Decimal(0)):
            raise ValueError("Rows must balance")
        self._entries.extend(entries)
