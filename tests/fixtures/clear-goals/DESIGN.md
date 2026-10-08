# Design

The approved stack is a local Node application with a JSON file for persistence.
The queue owns article state and exposes save, list and mark-read operations.
Presentation uses the queue's public operations and never writes storage directly.
Preserve article titles and addresses when marking an article read.
There are no open design decisions.
