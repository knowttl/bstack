import unittest
from decimal import Decimal

from ledger import Ledger


class LedgerTest(unittest.TestCase):
    def test_balanced_posting(self):
        ledger = Ledger()
        ledger.post("cash", "equity", "10")
        self.assertEqual(ledger.balance("cash"), Decimal("10"))
        self.assertTrue(ledger.balanced())

    def test_negative_posting_rejected(self):
        with self.assertRaises(ValueError):
            Ledger().post("cash", "equity", "-1")


if __name__ == "__main__":
    unittest.main()
