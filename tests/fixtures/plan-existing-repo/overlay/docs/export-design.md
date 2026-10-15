# Personal backup export design

Status: approved by the owner.

## Requirements

A reader exports their own saved articles to one file for personal backup, and imports that file back.
Export includes each article's title, address and read status.
It never includes accounts, sharing or recommendations, which stay outside the product.

## Stories

### S1 Export saved articles (core)

- Acceptance: exporting a queue of three articles writes one file that lists all three with title, address and read status.
- Acceptance: exporting an empty queue writes a file that imports as an empty queue.

### S2 Import a backup file (core)

- Acceptance: importing a file written by export restores every article with its read status.
- Acceptance: importing a file that is not an export is refused and changes nothing.

## Non-functional targets

- N1: Exporting 1,000 articles takes under 1 second.
