"""Build a dashboard-ready JSON snapshot from an extracted PBIX data export.

Usage: python build_dashboard_data.py input.json ../data/dashboard-data.json
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from vesta_calculations import balance_sheet, budget_vs_actual, profit_and_loss, value


def main(input_path: Path, output_path: Path) -> None:
    source = json.loads(input_path.read_text(encoding="utf-8"))
    financial = source["financialKpi"]
    latest = max(financial, key=lambda row: float(value(row, "monthSort")))
    month_sort = int(value(latest, "monthSort"))
    period = str(value(latest, "month"))[:7]
    summary = {
        "balance_sheet": balance_sheet(financial, month_sort),
        "profit_and_loss": profit_and_loss(financial, [latest]),
        "budget_vs_actual": budget_vs_actual(financial, source.get("budget", []), period),
    }
    result = {**source, "extractedAt": datetime.now(timezone.utc).isoformat(), "source": "Python refresh pipeline", "excluded": ["Accounting / Live Voucher Detail"], "computed": summary}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python build_dashboard_data.py INPUT_JSON OUTPUT_JSON")
    main(Path(sys.argv[1]), Path(sys.argv[2]))
