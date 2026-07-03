# Base technology

Whatever different methods of autotagging we do, we should use the same set of solid functions for regex, xpath navigation, and validation. I'm sure that these things are widely available, but I've built such things into sanmiao, so we can look at that package.

Specifically:
- If possible, we insert tags into text nodes to avoid breaking the XML
- We 'deduplicate', removing nested `<persName>` for example.
- We set up schema-based rules to clean tags that go where they shouldn't (e.g., `<date>` inside a `<placeName>`).
- After cleanup, we run validation and try to resolve all issues before rebuilding the document and letting the user clean up.
# East Asian dates

- sanmiao python package, adapted for TEI
# Regex (dumb mode)

At the very least, we should offer the ability to import tables with 'string' and 'tag' columns. We sort by string length, descending, and tag in order.

Sources:
- Spreadsheets (tsv, csv, xlsx, LibreOffice, etc.)
- Internal: crawl project XML to compile an internal list and apply that list
- SQL server: I'm not really sure how this would work, but the user connects JB to his SQL server and identifies the table and columns that contain search strings for particular tags. When launched, JB fetches those strings
# AI mode

Mode 1, tag: The user supplies a list of tags. We use the AI API to feed the document to the AI with the list of tags that interests him. The AI does not operate on the text itself, but analyses it and sends back via JSON instructions necessary for the accurate 'mechanical' tagging of what it identifies as `<persName>`, etc. 

Mode 2, clean: take a dumb-tagged document, identify mistakes, maybe give a one-sentence explanation of why it is a mistake, do a walk where the user rapidly decides in each case to keep, add, or correct that is:
- dumb mode missed something, add according to ai's advice
- dumb mode incorrectly identified something as a NE, remove
- dumb mode used the wrong tag or drew the boundary incorrectly, correct
# NER

The user would supply a language model (?), but this would depend on the language.... the user should do that himself.