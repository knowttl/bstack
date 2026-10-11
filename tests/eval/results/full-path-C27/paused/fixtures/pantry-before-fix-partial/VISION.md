# Pantry list vision

## Purpose and responsibility
Pantry list helps one household record named pantry supplies and see which supplies it needs to buy.
The project owns a clear path from recording an item to marking it needed and viewing it on the shopping list.
These commitments come from the author-approved brief and intent, not from project history.

## Household simplicity
An item is one named pantry supply, and the shopping list contains items marked as needing to buy.
Needed records the household intention to buy independently of stock.
The household supplies the names that make sense to it.
Names are trimmed, and a case-insensitive full-name match reuses the existing item.
Variants remain distinct when their full supplied names differ, such as Brown Rice and White Rice.
Accept changes that make recording supplies and reviewing needed items easier to understand.
Resist changes that require quantities or stock levels to complete this journey.

## Local control and honest persistence
Version one runs locally in a browser without an account, server or remote service.
The household can add Rice, mark it needed, view it on the shopping list, reload and retain it when local saving succeeds.
A failed local save keeps the current session usable and clearly exposes unsaved changes.
The household can explicitly retry saving the current session, including its needed choices.
The session remains editable while storage is unavailable, and unsaved status clears only after successful saving.
Reload retention is promised only after successful local saving.
Accept changes that preserve a usable household session and make the status of local saving understandable.
Resist changes that silently lose household choices or promise persistence without successful saving.

## Boundaries
Quantities, stock levels, accounts, shared remote synchronization and hosted services are outside version one.
The project does not own deployment, release or delivery services.

## Contribution tests
A change fits when it improves the household's named-item and needed-list journey while preserving local use and truthful saving.
Resist a change when it complicates that journey with inventory accounting or dependence on a remote system.
