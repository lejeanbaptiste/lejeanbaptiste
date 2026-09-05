# Entity data provenance

`entities.xml` stores both user-curated facts and values imported from external
sources. Individual values may carry these attributes:

| Attribute | Values                            | Meaning                                             |
| --------- | --------------------------------- | --------------------------------------------------- |
| `origin`  | `user`, `authority`, `xml`        | Where the value came from                           |
| `source`  | stable source key                 | Authority identifier or XML wrapper/source key      |
| `status`  | `active`, `rejected`, `withdrawn` | Whether the value participates in the active entity |

Values without these attributes remain valid legacy data and are treated as
user data, except for `<idno>`, authority-cache notes, and existing
`#grognard-autotag` values, which are treated as authority data.

## Curation lifecycle

Imported values are active until the user validates or rejects them. Validation
changes `origin` to `user` and preserves `source` as an audit trail. Rejection
keeps the value in the XML as a tombstone, with `status="rejected"`, so a
future refresh does not re-add the same assertion.

Decoupling an authority removes its active authority values and cache entries.
Rejected values remain so the user's decision survives a database refresh.

XML-extracted values use stable source keys such as
`xml:document-id#wrapper-id`. An extraction refresh reconciles the current
wrapper assertions with stored assertions. Missing, unvalidated extracted
values can therefore be withdrawn or removed; validated user values remain.

The desktop Entity Database panel displays active origins as badges and offers
validation/rejection actions for imported assertions. Rejected assertions are
hidden by default and can be surfaced with the rejected-data toggle.

This format is intentionally additive: existing TEI names, identifiers,
nationalities, titles, and notes remain ordinary TEI elements.
