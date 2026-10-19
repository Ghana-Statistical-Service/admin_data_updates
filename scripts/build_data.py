"""Rebuild data/data.js from the four JSON files in data/.
Run after you replace any of them:  python3 scripts/build_data.py"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
names = ["districts", "district_areas", "district_years", "district_indicator_years", "submissions"]
data = {n: json.loads((root / "data" / f"{n}.json").read_text()) for n in names}
(root / "data" / "data.js").write_text("window.MMDA_DATA=" + json.dumps(data, separators=(",", ":")) + ";\n")
print({n: len(v) for n, v in data.items()})
