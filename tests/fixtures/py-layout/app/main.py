from app.registry import FEATURES

print(FEATURES["checkout"].receipt(FEATURES["cart"].total(2)))
