"""Seed importer for the PRA Rates-Coverage Analysis workbook.

Reads the 'PRA Research Prices' sheet and creates a PriceMasterVersion with
all procedures + prices. Section header rows (e.g. "  ▶  RESEARCH ADMINISTRATION")
are recognized and used as the procedure category for the rows that follow.

Note: the price values in the sample file are illustrative — the user noted the
numbers are incomplete. This importer takes whatever numbers are present; an
admin can correct them in-app after seeding.
"""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

import openpyxl

from app.config import settings
from app.db import SessionLocal
from app.models import (
    PriceMasterVersion,
    Procedure,
    ProcedurePrice,
    CoverageStatus,
    FixedFeeTemplate,
    FixedFee,
    FixedFeeKind,
)

PRA_FILENAME = "PRA- Rates-Coverage Analysis.xlsx"
RESEARCH_PRICES_SHEET = "PRA Research Prices"
COVERAGE_ANALYSIS_SHEET = "PRA-Coverage Analysis"

SECTION_PREFIX = "▶"

COVERAGE_MAP = {
    "QCT – Covered": CoverageStatus.QCT_COVERED,
    "QCT - Covered": CoverageStatus.QCT_COVERED,
    "Research Required": CoverageStatus.RESEARCH_REQUIRED,
    "Research Required / QCT Shared": CoverageStatus.SHARED,
}

# Default sponsor/medicare share when only the qualitative status is known.
SHARE_DEFAULT = {
    CoverageStatus.QCT_COVERED: (0.0, 1.0),
    CoverageStatus.RESEARCH_REQUIRED: (1.0, 0.0),
    CoverageStatus.SHARED: (0.6, 0.4),
}


def _coerce_float(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        s = value.strip()
        if not s or s.upper() in {"N/A", "NA", "TBD"}:
            return None
        try:
            return float(s.replace(",", "").replace("$", ""))
        except ValueError:
            return None
    return None


def _is_section_row(cell_value) -> bool:
    return isinstance(cell_value, str) and SECTION_PREFIX in cell_value


def _section_name(cell_value: str) -> str:
    return cell_value.replace(SECTION_PREFIX, "").strip().title()


def import_price_master(xlsx_path: Path, label: str) -> int:
    """Read the PRA workbook and create a published PriceMasterVersion.

    Returns the version id. Idempotency: each call creates a new version row.
    """
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb[RESEARCH_PRICES_SHEET]

    db = SessionLocal()
    try:
        version = PriceMasterVersion(
            label=label,
            effective_date=date.today(),
            is_published=True,
            notes=f"Imported from {xlsx_path.name}",
        )
        db.add(version)
        db.flush()

        current_category: str | None = None
        rows_imported = 0

        # Header is at row 4; data starts at row 5.
        for row in ws.iter_rows(min_row=5, values_only=True):
            if not row or all(c is None for c in row):
                continue

            first = row[0]
            if _is_section_row(first):
                current_category = _section_name(first)
                continue

            code = (str(first).strip() if first is not None else "")
            name = str(row[1]).strip() if len(row) > 1 and row[1] is not None else ""
            coverage_raw = str(row[2]).strip() if len(row) > 2 and row[2] is not None else ""

            if not code or not name:
                continue

            coverage = COVERAGE_MAP.get(coverage_raw)
            if coverage is None:
                continue  # skip rows with unrecognized status

            medicare_rate = _coerce_float(row[3]) if len(row) > 3 else None
            amc_base = _coerce_float(row[4]) if len(row) > 4 else None
            if amc_base is None:
                continue

            sponsor_share, medicare_share = SHARE_DEFAULT[coverage]
            excluded_from_oh = "stipend" in name.lower()

            proc = Procedure(
                version_id=version.id,
                code=code,
                name=name,
                category=current_category,
                coverage_status=coverage,
                cpt_code=code if code.isdigit() else None,
            )
            proc.price = ProcedurePrice(
                medicare_rate=medicare_rate,
                amc_base_charge=amc_base,
                overhead_pct=settings.default_overhead_pct,
                excluded_from_oh=excluded_from_oh,
                sponsor_share=sponsor_share,
                medicare_share=medicare_share,
            )
            db.add(proc)
            rows_imported += 1

        db.commit()
        print(f"Imported {rows_imported} procedures into price master version {version.id}")
        return version.id
    finally:
        db.close()


def seed_default_fixed_fees(label: str) -> int:
    """Create a default FixedFeeTemplate from the values in the Final Budget Presentation."""
    db = SessionLocal()
    try:
        tmpl = FixedFeeTemplate(
            label=label,
            effective_date=date.today(),
            is_published=True,
            notes="Default site fees + pass-through costs",
        )
        db.add(tmpl)
        db.flush()

        site_fees = [
            ("Non-Refundable Administrative Start-Up Fee", 3000, 15000, "One-time upon CTA execution"),
            ("Annual Advertising / Recruitment / Chart Review Fee", 5000, 7500, "Annual during recruitment"),
            ("Annual Subject Retention Fee", 3000, 5000, "Annual"),
            ("SAE Report - Adjudicated Event", 200, 450, "Per event"),
            ("SAE Report - Non-Adjudicated Event", 150, 300, "Per event"),
            ("Unscheduled Visit - Onsite", 325, 500, "Per occurrence"),
            ("Onsite Visit Converted to Phone/Remote Visit", 700, 800, "Per occurrence"),
            ("Type 2 Diabetes Phone Call - Insulin Titration Adjustment", 250, 350, "Per call"),
            ("Echocardiography at Screening", 800, 1575, "Per subject if applicable"),
            ("Eye Examination with OCT (T2D)", 527, 1437.75, "Per exam (T2D only)"),
            ("Subject Re-Consent Fee", None, 250, "Per occurrence"),
            ("Protocol Amendment Fee", None, 2000, "Per amendment"),
            ("Document Storage - On-Site (Years 1-2)", None, 750, "Annual"),
            ("Document Storage - Off-Site (Year 3+)", None, 1200, "Annual"),
            ("CTMS Monthly Maintenance Fee", None, 275, "Monthly"),
            ("FDA Audit Fee", None, 2360, "Flat fee per audit"),
            ("Sponsor Audit Fee", None, 1250, "Per day on-site"),
            ("Screen Failure Fee", None, 750, "Per screen failure"),
            ("New Onset Diabetes Management Visit", None, 450, "Per event"),
            ("Dose Re-Escalation Phone Contact", None, 200, "Per contact"),
            ("Urgent/Worsening HF Outpatient Visit Data Collection", None, 500, "Per event"),
            ("Optional AF Burden Sub-Study - Visit 2", 1107, 3024, "Per subject if applicable"),
            ("Optional AF Burden Sub-Study - Visit 12", 859, 2366, "Per subject if applicable"),
            ("AF Sub-Study Troubleshooting Phone Call", 150, 250, "Per call if applicable"),
        ]
        for i, (name, sponsor, site, freq) in enumerate(site_fees):
            db.add(FixedFee(
                template_id=tmpl.id,
                name=name,
                kind=FixedFeeKind.SITE_FEE,
                sponsor_proposed=sponsor,
                site_default=site,
                frequency=freq,
                sort_order=i,
            ))

        pass_throughs = [
            ("Biohazard Waste Disposal Fee", None, 1800, "Annual"),
            ("Research Pharmacy Annual Maintenance Fee", None, 3500, "Annual"),
            ("Quarterly Administrative Fees", None, 5000, "Annual"),
            ("Imaging Dept. Annual Maintenance Fee", None, 5500, "Annual"),
            ("Monitor (CRA) and/or CRO change fee", None, 1250, "Per change"),
            ("Laboratory Annual Maintenance Fee", None, 2500, "Annual"),
            ("Site Close out visit Fee", None, 7500, "Once at Close out"),
            ("Equipment Calibration & Preventative Maintenance Fee", None, 1500, "Annual"),
            ("Equipment Depreciation Fee", None, 3000, "Annual"),
            ("Equipment Service Agreement Fee", None, 2500, "Annual"),
            ("Patient Transportation, Meals, Hotel", None, 0, "Pass through at cost"),
            ("Sponsor Early Termination of Study", None, 15000, "Once at Termination"),
        ]
        for i, (name, sponsor, site, freq) in enumerate(pass_throughs):
            db.add(FixedFee(
                template_id=tmpl.id,
                name=name,
                kind=FixedFeeKind.PASS_THROUGH,
                sponsor_proposed=sponsor,
                site_default=site,
                frequency=freq,
                sort_order=i,
            ))

        db.commit()
        print(f"Seeded fixed fee template {tmpl.id} with {len(site_fees)} site fees + {len(pass_throughs)} pass-throughs")
        return tmpl.id
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Seed the price master from the sample PRA workbook")
    parser.add_argument("--label", default="Imported from sample PRA")
    parser.add_argument("--xlsx", default=str(settings.samples_dir / PRA_FILENAME))
    args = parser.parse_args()

    import_price_master(Path(args.xlsx), label=args.label)
    seed_default_fixed_fees(label=args.label)


if __name__ == "__main__":
    main()
