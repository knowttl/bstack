# Pantry list — project vision

## Approval

Approved baseline, based on the owner-approved goals and stack choices in [brief.md](brief.md). There are no open decisions in that brief. This document records that intent; it does not add product requirements.

## Project intent

Help a household record its pantry supplies and make a shopping list of what is missing. The household should be able to see what it has recorded and what it needs to buy.

## First-version scope

- Record named pantry items.
- Make a shopping list containing items the household needs to buy.
- Run locally in a browser, using TypeScript and local storage.
- Require no account, server, or remote service.

## Useful domain terms

| Term | Meaning |
| --- | --- |
| Household | The people whose pantry supplies and shopping needs the app represents. This does not imply user accounts or shared-device synchronization. |
| Item | One named pantry supply. |
| Pantry | The household's supplies. |
| Pantry list | The app's record of pantry items. |
| Missing item | A pantry supply the household needs to buy. |
| Shopping list | A collection of items the household needs to buy. |
| Local storage | Browser storage used to retain the app's data locally. |

## Scope boundaries

Accounts, a server, and remote services are outside the first version. Quantities, automatic detection of missing items, recipes, expiry tracking, and synchronization are not requirements established by the brief.

## Success criteria

The first version succeeds when a household can record pantry items and make a shopping list of needed supplies in a local browser app, with data retained in local storage and no dependency on an account, server, or remote service.
