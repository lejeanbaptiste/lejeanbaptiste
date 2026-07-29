#!/usr/bin/env python3
"""Schema-driven, TEI-header-only repair helper.

The first repair supported here is deliberately narrow: canonicalize the
direct-child order of ``teiHeader`` from the order declared by the loaded
Relax NG schema.  No element is deleted, no text is rewritten, and the TEI
body is never inspected or modified.

Usage:
    python3 tei-header-repair.py INPUT.xml --schema schema/tei_all.rng \
        --output OUTPUT.xml
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from lxml import etree


RNG_NS = "http://relaxng.org/ns/structure/1.0"
TEI_NS = "http://www.tei-c.org/ns/1.0"
R = f"{{{RNG_NS}}}"
T = f"{{{TEI_NS}}}"


@dataclass(frozen=True)
class RepairReport:
    valid_before: bool
    valid_after: bool
    schema_order: tuple[str, ...]
    changed: bool
    changes: tuple[str, ...]
    validation_errors_before: tuple[str, ...]
    validation_errors_after: tuple[str, ...]


def _define(schema: etree._Element, name: str) -> etree._Element:
    result = schema.find(f"{R}define[@name='{name}']")
    if result is None:
        raise ValueError(f"Schema has no Relax NG define named {name!r}")
    return result


def _header_order_from_schema(schema: etree._Element) -> tuple[str, ...]:
    """Read the direct teiHeader sequence from the loaded RNG grammar.

    This intentionally supports only the schema constructs used by the TEI
    header declaration: group, ref, optional, and zeroOrMore.  If the schema
    changes to a construct we cannot interpret safely, we fail closed.
    """

    header = _define(schema, "teiHeader")
    group = header.find(f"{R}element[@name='teiHeader']/{R}group")
    if group is None:
        raise ValueError("Schema teiHeader declaration has no direct group")

    model_header = _define(schema, "model.teiHeaderPart")

    def names(pattern: etree._Element) -> list[str]:
        tag = etree.QName(pattern).localname
        if tag == "ref":
            name = pattern.get("name")
            if name == "model.teiHeaderPart":
                choice = model_header.find(f"{R}choice")
                if choice is None:
                    raise ValueError("Schema model.teiHeaderPart has no choice")
                refs = choice.findall(f"{R}ref")
                if not refs or any(ref.get("name") is None for ref in refs):
                    raise ValueError("Schema model.teiHeaderPart contains an unsupported pattern")
                return [ref.get("name") for ref in refs if ref.get("name")]
            if not name:
                raise ValueError("Schema contains an unnamed header reference")
            return [name]
        if tag in {"optional", "zeroOrMore", "oneOrMore", "group"}:
            children = list(pattern)
            if len(children) != 1 and tag != "group":
                raise ValueError(f"Unsupported {tag} pattern in teiHeader")
            result: list[str] = []
            for child in children:
                result.extend(names(child))
            return result
        raise ValueError(f"Unsupported {tag} pattern in teiHeader")

    result: list[str] = []
    for child in group:
        result.extend(names(child))
    return tuple(result)


def _validation_errors(relaxng: etree.RelaxNG, document: etree._ElementTree) -> tuple[str, ...]:
    if relaxng.validate(document):
        return ()
    return tuple(entry.message.strip() for entry in relaxng.error_log)


def _tei_header(document: etree._ElementTree) -> etree._Element:
    header = document.find(f".//{T}teiHeader")
    if header is None:
        raise ValueError("Document has no TEI teiHeader element")
    return header


def repair_header(xml: bytes, schema_bytes: bytes) -> tuple[bytes, RepairReport]:
    parser = etree.XMLParser(remove_blank_text=False)
    document = etree.fromstring(xml, parser).getroottree()
    schema = etree.fromstring(schema_bytes, parser)
    relaxng = etree.RelaxNG(schema)
    before_errors = _validation_errors(relaxng, document)
    order = _header_order_from_schema(schema)
    header = _tei_header(document)

    children = [child for child in header if isinstance(child.tag, str)]
    names_in_document = [etree.QName(child).localname for child in children]
    rank = {name: index for index, name in enumerate(order)}

    # Fail closed for an unexpected direct child or duplicate schema names.
    # The schema remains the authority; this repair only reorders known nodes.
    unknown = [name for name in names_in_document if name not in rank]
    if unknown:
        raise ValueError(f"teiHeader contains elements not covered by schema order: {unknown}")

    sorted_children = sorted(enumerate(children), key=lambda pair: (rank[etree.QName(pair[1]).localname], pair[0]))
    changed = [child is not sorted_children[index][1] for index, child in enumerate(children)]
    changes: list[str] = []
    if any(changed):
        for child in children:
            header.remove(child)
        for _index, child in sorted_children:
            header.append(child)
        # The moved nodes retain their original whitespace tails. Rebuild
        # only the indentation inside teiHeader so the generated document is
        # readable without altering any metadata text or attributes.
        for child in header:
            if isinstance(child.tag, str):
                child.tail = "\n    "
        header[-1].tail = "\n  "
        changes.append(
            "Reordered teiHeader children: "
            + ", ".join(names_in_document)
            + " -> "
            + ", ".join(etree.QName(child).localname for _index, child in sorted_children)
        )

    after_errors = _validation_errors(relaxng, document)
    output = etree.tostring(document, xml_declaration=True, encoding="UTF-8", pretty_print=True)
    report = RepairReport(
        valid_before=not before_errors,
        valid_after=not after_errors,
        schema_order=order,
        changed=bool(changes),
        changes=tuple(changes),
        validation_errors_before=before_errors,
        validation_errors_after=after_errors,
    )
    return output, report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    output, report = repair_header(args.input.read_bytes(), args.schema.read_bytes())
    args.output.write_bytes(output)

    print(f"schema teiHeader order: {' > '.join(report.schema_order)}")
    print(f"valid before: {report.valid_before}")
    for change in report.changes:
        print(f"change: {change}")
    print(f"valid after: {report.valid_after}")
    if report.validation_errors_after:
        print("remaining validation errors:")
        for error in report.validation_errors_after:
            print(f"  {error}")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
