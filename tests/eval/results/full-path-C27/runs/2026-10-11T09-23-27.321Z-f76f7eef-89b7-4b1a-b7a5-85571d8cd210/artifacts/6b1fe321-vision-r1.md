# Pantry list vision

## Purpose and responsibility
This project helps a household remember its named pantry supplies and decide what to buy.
It owns a simple pantry record and a shopping list derived from the household's needed choices.
Version one serves a household locally in a browser, without an account, server or remote service.
These commitments come from the author's approved brief and intent interview, not project history.

## Household control
An item represents one named pantry supply.
The household explicitly marks which items it needs to buy.
The shopping list contains those needed items.
Accept changes that make those choices easy to record and understand.
Resist changes that substitute inferred inventory decisions for the household's choice.
Quantities and stock levels are outside version one's responsibility.

## Clear names
Names let the household recognize and distinguish its supplies.
Accept changes that prevent accidental duplicate records without hiding meaningful differences between supplies.
Resist changes that force a product catalogue or complex classification before a household can add an item.

## Honest retention
The household can add Rice, mark it needed, view it on the shopping list, reload and retain it after successful saving.
Local persistence must communicate whether changes are saved.
Accept changes that keep the session useful and make saving problems visible.
Resist changes that promise retention when saving has failed.

## Boundaries and contribution tests
Version one uses TypeScript and local storage in a local browser.
Accounts, remote synchronization, servers, quantities and stock levels are non-goals.
A change aligns when it strengthens the household's ability to record named supplies, choose what to buy and understand whether its choices will survive reload.
Resist a change when it expands those responsibilities or weakens explicit household control or honest persistence without a new author decision.
