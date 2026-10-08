# Pantry list vision

## Purpose
Pantry list helps a household record pantry items and make a shopping list of what is missing.
Its responsibility is to connect the household’s pantry record with the supplies it needs to buy.
The first useful journey is recording named pantry supplies, identifying what is missing, and viewing a shopping list.

## Household commitments
Version one runs locally in a browser using TypeScript and local storage.
The pantry and shopping-list journey needs no account, server, or remote service.
An item is one named pantry supply.
A shopping list contains items the household needs to buy.
Accept changes that help the household record supplies or understand shopping needs while preserving local use.
Resist changes that require registration or a remote dependency to complete this journey.

## Boundaries
The project owns pantry recording and shopping-list preparation for a household.
It does not own purchasing, retailer services, or general household management.
Version one does not provide accounts, a server, remote services, or shared-device synchronization.
Quantities and automatic replenishment are not established commitments; proposals for them must justify their contribution to the household’s pantry and shopping-list journey.

## Contribution tests
A change fits when it directly helps a household record pantry items or make a shopping list within the local, account-free boundary.
Resist a change when it expands the project’s responsibility or makes the approved journey depend on a remote service.
