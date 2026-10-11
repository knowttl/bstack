# Pantry list vision

## Purpose and responsibility
Pantry list helps a household remember its pantry supplies and what it needs to buy.
It owns a local record of named supplies and a shopping list derived from the supplies marked needed.
These commitments come from the owner’s confirmed intent for version one, rather than existing project history.

## Household scope
Version one runs locally in a browser using TypeScript and local storage.
It requires no account, server or remote service.
Accept changes that improve the household’s ability to record supplies and see what it needs to buy.
Resist changes that make this local journey depend on a remote system or expand it into household account management.

## Named supplies and shopping intent
An item is one named pantry supply.
The shopping list contains items marked as needing to buy.
The needed mark records the household’s intention to buy independently of whether the supply is present.
The household controls that mark as a shopping decision; it is not inferred from stock.
Names are trimmed, and a case-insensitive match on the full supplied name reuses the existing item.
Brown Rice and White Rice remain distinct supplies because their full supplied names differ.
Quantities and stock levels are outside version one.

## Trustworthy local use
The first useful journey is to add Rice, mark it needed, view Rice on the shopping list, and reload with that decision retained.
The interface tells the household whether its changes have been saved.
When local storage saving fails, the current session remains usable and unsaved changes are visible.
Reload retention is claimed only after local saving succeeds.
Accept reliability changes that preserve useful local work and make persistence limits visible.

## Contribution tests
A change aligns when it makes named supplies and needed purchases easier to manage locally while preserving an honest account of saved state.
Resist a change when it requires quantities, stock accounting, accounts, a server or remote services to complete this journey, or obscures whether local work is retained.
