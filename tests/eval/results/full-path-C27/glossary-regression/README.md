# Glossary identity regression

The public installed `evidence collect` command included optional contract glossary metadata in candidate document identities.
The corresponding assessment then failed `evidence validate` with `unknown-field` at `$/documents/1/glossary`.
Both observations are retained in the `before` captures from the interrupted pantry fixture.

After the shared inventory projection was fixed and the complete package was installed into a fresh isolated home, collection retained only ID and path in assessment identities.
The contract's glossary metadata remains intact.
The `after` validation capture advances to substantive missing-assessment, first-policy and freshness checks without the schema rejection.
That incomplete historical fixture still has a blocked maintenance result; this capture is a focused reproduction, not final full-path acceptance.

The public-command regression provides the complete positive control:

```sh
node --test --test-name-pattern 'glossary metadata does not prevent a complete document assessment' tests/scripts/evidence-validate.test.mjs
```

It passed one test with no failure, skip or cancellation on Node 24.17.0 and Linux.
The test adds glossary metadata to an existing contract document, collects the diff, completes the assessment, binds review, captures native checks and requires final validation to pass while the contract metadata survives.
The fresh final paths separately verify the corrected installed package end to end.

The [redaction manifest](redaction-manifest.json) binds the original and published bytes of the three captures whose internal workspace paths were replaced with neutral artifact placeholders.
Their original fingerprints remain historical observations; the redacted copies are not replayable local paths.
