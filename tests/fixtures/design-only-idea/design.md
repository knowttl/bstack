# Pantry list design

Status: approved by the owner.

## Requirements

Help a household record pantry items and make a shopping list of what is missing.
The first version runs locally in a browser using TypeScript and local storage.
It needs no account, server or remote service.

## Stories

### S1 Record a pantry item (core)

A household member adds a named pantry item with a quantity.

- Acceptance: after adding "rice" with quantity 2, the pantry shows "rice" with quantity 2.
- Acceptance: adding an item with an empty name is refused with a message.

### S2 Build the shopping list (core)

A household member marks an item as missing, and it appears on the shopping list.

- Acceptance: marking "rice" missing lists "rice" on the shopping list.
- Acceptance: marking it present again removes it from the list.

### S3 Clear bought items

A household member clears the items they bought from the shopping list.

- Acceptance: after clearing, the list is empty and the pantry still holds the items.

## Non-functional targets

- N1: Adding an item takes under 200 ms with 500 items stored.
- N2: After the first load, the app makes no network request.
