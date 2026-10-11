# Pantry language

## Item

An item is one named pantry supply.
Names are trimmed; case-insensitive full-name matches identify the same item.
Brown Rice and White Rice are distinct supplied names.

## Needed

Needed records the household’s intention to buy an item, independently of stock.
Re-adding an equivalent name preserves that mark; only an explicit needed-state change alters it.
There are no quantities or stock levels.

## Shopping list

The shopping list contains the items currently marked needed.

## Unsaved changes

Unsaved changes are current session changes that have not been successfully saved.
They remain usable in the session but are not promised to survive reload.
