"""Parser for client-uploaded SOA xlsx files.

The client sends a visit-grid in the same shape as the researcher's reference
SOA: column A = procedure code, column B = procedure name, columns C onwards
= one column per visit. A non-blank cell means "this procedure happens at this
visit"; the value itself is ignored (typically `X` or a price the client put in).

Header row is detected by the literal token 'Code' in column A. Multiple
header rows are supported (the sample file has two: the main procedure section
and a personnel/pass-through section lower down) — each header resets the
visit-label list, so rows below it use those labels.

Matching to the price master is by `code` (exact, case-sensitive) against the
trial's pegged PriceMasterVersion. Unmatched rows are returned for the user to
resolve manually.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO
from typing import Iterable

import openpyxl


HEADER_TOKEN = "Code"
NAME_COLUMN_TOKEN = "Name"


@dataclass
class ParsedCell:
    """One applicable (procedure × visit) cell extracted from the SOA."""

    code: str
    name: str
    visit_label: str
    raw_value: str  # what the client put in the cell ('X', '$45', etc.)


@dataclass
class ParsedSOA:
    trial_name: str | None
    cells: list[ParsedCell] = field(default_factory=list)
    skipped_rows: list[dict] = field(default_factory=list)


def _norm(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def parse_soa_bytes(data: bytes) -> ParsedSOA:
    wb = openpyxl.load_workbook(BytesIO(data), data_only=True)
    ws = wb.active
    return _parse_worksheet(ws)


def _parse_worksheet(ws) -> ParsedSOA:
    result = ParsedSOA(trial_name=None)
    visit_labels: list[str] = []  # column index (0-based) → visit label
    in_data_section = False

    for row in ws.iter_rows(values_only=True):
        if not row or all(c is None for c in row):
            continue

        first = _norm(row[0])

        # Capture trial name from rows like ['Trial Name:', None, 'NN9490-8266']
        if not in_data_section and "trial name" in first.lower():
            for c in row[1:]:
                if c:
                    result.trial_name = _norm(c)
                    break
            continue

        # Header row: "Code | Name | Visit 1A | Visit 1B | ..."
        if first == HEADER_TOKEN and len(row) > 1 and _norm(row[1]) == NAME_COLUMN_TOKEN:
            visit_labels = [_norm(c) for c in row[2:]]
            in_data_section = True
            continue

        if not in_data_section or not visit_labels:
            continue

        code = first
        name = _norm(row[1]) if len(row) > 1 else ""
        if not code or not name:
            # Footer rows like 'TOTAL' or notes — not data
            continue

        for col_idx, cell in enumerate(row[2:]):
            if col_idx >= len(visit_labels):
                break
            visit = visit_labels[col_idx]
            if not visit:
                continue
            value = _norm(cell)
            if not value:
                continue
            result.cells.append(
                ParsedCell(code=code, name=name, visit_label=visit, raw_value=value)
            )

    return result


@dataclass
class MatchResult:
    """Summary of mapping a ParsedSOA against a price master version."""

    matched_cells: list[dict]  # {procedure_id, code, name, visit_label}
    unmatched_codes: list[dict]  # {code, name, occurrence_count}


def match_against_price_master(
    parsed: ParsedSOA,
    procedures_by_code: dict[str, list[tuple[int, str]]],
) -> MatchResult:
    """Match parsed cells to procedures by code.

    procedures_by_code: {code: [(procedure_id, name), ...]}. A code may map to
    several procedures (e.g. '*INCO' covers two consent variants); when that
    happens we prefer a name match, otherwise we fall back to the first.
    """
    matched: list[dict] = []
    unmatched: dict[str, dict] = {}

    for cell in parsed.cells:
        candidates = procedures_by_code.get(cell.code)
        if not candidates:
            entry = unmatched.setdefault(
                cell.code, {"code": cell.code, "name": cell.name, "occurrence_count": 0}
            )
            entry["occurrence_count"] += 1
            continue

        proc_id = candidates[0][0]
        if len(candidates) > 1:
            for pid, pname in candidates:
                if pname.strip().lower() == cell.name.strip().lower():
                    proc_id = pid
                    break

        matched.append(
            {
                "procedure_id": proc_id,
                "code": cell.code,
                "name": cell.name,
                "visit_label": cell.visit_label,
            }
        )

    return MatchResult(matched_cells=matched, unmatched_codes=list(unmatched.values()))
