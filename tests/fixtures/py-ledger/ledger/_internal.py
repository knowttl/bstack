from decimal import Decimal


def amount(value):
    return Decimal(value).quantize(Decimal("0.01"))
