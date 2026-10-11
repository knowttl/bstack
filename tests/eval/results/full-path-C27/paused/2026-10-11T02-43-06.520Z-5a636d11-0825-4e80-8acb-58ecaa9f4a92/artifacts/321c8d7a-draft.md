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
The household controls that mark as a shopping decision.
Names should let the household recognise its supplies without accidental duplication.
Quantities and stock levels are outside version one.

## Trustworthy local use
The first useful journey is to add Rice, mark it needed, view Rice on the shopping list, and reload with that decision retained.
The interface tells the household whether its changes have been saved.
A storage problem must not make the current session unusable or imply that unsaved changes will survive a reload.
Accept reliability changes that preserve useful local work and make persistence limits visible.

## Contribution tests
A change aligns when it makes named supplies and needed purchases easier to manage locally while preserving an honest account of saved state.
Resist a change when it requires quantities, stock accounting, accounts, a server or remote services to complete this journey, or obscures whether local work is retained.
