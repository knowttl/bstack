# Pantry list vision

## Purpose
Help a household record its pantry supplies and make a shopping list of what is missing.
The project owns the connection between what the household records in its pantry and what it needs to buy.
Success means the household can record named supplies and use a shopping list to identify needed purchases.

## Household scope
Version one serves one household locally in a browser.
An item is one named pantry supply.
A shopping list contains items the household needs to buy.
The household marks which named supplies it needs to buy.
Version one does not track quantities or stock levels.

## Local operation
Version one uses TypeScript and browser local storage.
Its pantry and shopping-list journey requires no account, server or remote service.
Changes must preserve this local journey and its independence from remote services.
Browser-local storage does not promise shared state across devices or recovery after browser data is cleared.
Optional manual transfer of records between household browsers fits the vision without requiring accounts or remote services.
Manual transfer is compatible with the project, but is not a mandatory version-one feature.

## Boundaries
Version one does not provide account management, remote synchronisation or multi-household coordination.
Recording pantry supplies and preparing needed purchases define the project's responsibility.
Recipe planning, recipe-based shopping suggestions, retailer ordering and unrelated household management are outside that responsibility.
Recipes are not required to identify purchases.

## Contribution acceptance
Accept changes that make recording named pantry supplies or managing household-marked buying needs more useful while preserving local operation.
Resist changes that make the core journey depend on accounts or remote services, serve multiple households, or turn the project into a broader planning or commerce product.
