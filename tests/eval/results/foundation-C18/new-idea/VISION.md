# Pantry list vision

## Purpose and responsibility
Pantry list helps a household record pantry supplies and maintain a shopping list of items it needs to buy.
An item is a named pantry supply.
A shopping list contains items the household marks as needing to buy.
The household decides which items are needed; the project records and presents those decisions.

## Local household use
Version one runs locally in a browser using TypeScript and local storage.
It requires no account, server or remote service.
Recorded items and shopping needs persist after a browser reload.
Changes must preserve this local household model.

## Focus and boundaries
Accept changes that make recording named pantry items, marking shopping needs and viewing the shopping list clearer and more dependable.
Version one does not track quantities, stock levels or low-stock thresholds, because they add maintenance beyond the simple household marking journey.
Recipe and meal planning remain excluded as separate responsibilities, even when implemented locally.
Accounts, remote synchronization, shared online household services, retailer integration and automatic purchasing are outside version one.

## Contribution acceptance
A change aligns when it supports household-controlled pantry recording and shopping needs while preserving local browser use and retained data without remote dependencies.
Resist a change when it introduces stock tracking or separate planning responsibilities, requires accounts or remote services, or adds complexity without a clear benefit to the household marking journey.
