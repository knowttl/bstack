# Pantry list vision

## Purpose
Help a household record its pantry supplies and make a shopping list of what is missing.
The project owns the connection between what the household records in its pantry and what it needs to buy.
Success means the household can record named supplies and use a shopping list to identify needed purchases.

## Household scope
Version one serves one household locally in a browser.
An item is one named pantry supply.
A shopping list contains items the household needs to buy.
The household supplies the information needed to identify what is missing.
The vision leaves the exact interaction for recording shortages to product design.

## Local operation
Version one uses TypeScript and browser local storage.
Its pantry and shopping-list journey requires no account, server or remote service.
Changes must preserve this local journey and its independence from remote services.
Browser-local storage does not promise shared state across devices or recovery after browser data is cleared.

## Boundaries
Version one does not provide account management, remote synchronisation or multi-household coordination.
Recording pantry supplies and preparing needed purchases define the project's responsibility.
Meal planning, retailer ordering and unrelated household management are outside that responsibility.

## Contribution acceptance
Accept changes that make recording pantry supplies or identifying needed purchases more useful for a household while preserving local operation.
Resist changes that make the core journey depend on accounts or remote services, serve multiple households, or turn the project into a broader planning or commerce product.
