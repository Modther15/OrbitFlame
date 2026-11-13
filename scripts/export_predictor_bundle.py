"""Maintainer tool (not needed to run OrbitFlame): export the fitted empirical predictors to public/data/predictor_bundle.json.

The Next.js route handlers evaluate these predictors in TypeScript, so the app needs no Python at run time.
Each candidate carries its verified feature list, standardisation constants, the real experimental rows used for the
nearest-test lookup, and (only if it passed the dummy-baseline gate) the fitted trees of its GradientBoosting / RandomForest
model. Nothing is generated or imputed: every row and tree comes from the trained artifact.

Usage (from a checkout that has the research pipeline and its trained artifact):
    python scripts/export_predictor_bundle.py --project-root /path/to/research/project
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def export_tree(tree, class_index: int | None) -> dict:
    t = tree.tree_
    if class_index is None:
        leaf = t.value[:, 0, 0]
    else:
        v = t.value[:, 0, :]
        leaf = v[:, class_index] / v.sum(axis=1)
    return {
        "f": [int(x) for x in t.feature],
        "t": [float(x) if f >= 0 else 0 for x, f in zip(t.threshold, t.feature)],   # exact: x <= threshold must match float32 data points
        "l": [int(x) for x in t.children_left],
        "r": [int(x) for x in t.children_right],
        "v": [float(f"{float(x):.12g}") for x in leaf],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project-root", required=True, help="folder containing data/processed/flammability_model.joblib")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[1] / "public" / "data" / "predictor_bundle.json"))
    a = ap.parse_args()
    root = Path(a.project_root).resolve()
    sys.path.insert(0, str(root))
    import joblib
    import numpy as np
    import sklearn

    m = joblib.load(root / "data" / "processed" / "flammability_model.joblib")
    reports = {c["id"]: c for c in m["report"]["candidates"]}
    out: dict = {"format_version": 1, "generated": datetime.now(timezone.utc).isoformat(), "sklearn_version": sklearn.__version__,
                 "label_insufficient": m.get("label_insufficient"), "candidates": {}}
    for cid, b in m["candidates"].items():
        rep = reports[cid]
        item: dict = {
            "id": cid, "title": b["title"], "psi_ids": b["psi_ids"], "target_desc": b["target_desc"], "task": b["task"],
            "positive": b.get("positive"), "passed_gate": bool(b["passed_gate"]),
            "report": {"n_samples": rep["n_samples"], "scores": rep.get("scores"), "gate_checks": rep.get("gate_checks"), "label": rep.get("label")},
        }
        if "features" in b:
            item["features"] = b["features"]
            item["mean"] = [float(b["mean"][f]) for f in b["features"]]
            item["std"] = [float(b["std"][f]) for f in b["features"]]
            item["rows"] = b["rows"]
        mdl = b.get("model")
        if mdl is not None:
            if b["task"] == "clf":
                ci = list(mdl.classes_).index(1)
                item["model"] = {"kind": "rfc", "trees": [export_tree(e, ci) for e in mdl.estimators_]}
            else:
                init = float(mdl.init_.predict(np.zeros((1, len(b["features"]))))[0])
                item["model"] = {"kind": "gbr", "init": float(init), "learning_rate": float(mdl.learning_rate),
                                 "trees": [export_tree(e[0], None) for e in mdl.estimators_]}
        out["candidates"][cid] = item
    Path(a.out).write_text(json.dumps(out, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(f"wrote {a.out} ({Path(a.out).stat().st_size / 1e6:.2f} MB, {len(out['candidates'])} candidates)")


if __name__ == "__main__":
    main()
