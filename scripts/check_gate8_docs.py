#!/usr/bin/env python3
"""Gate-8 docs check: every required doc exists with its required headings."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

REQUIRED = {
    "docs/architecture.md": ["Context (DFD-0)", "Level 1", "Data model", "ML contract"],
    "docs/synopsis_delta.md": ["Synopsis promise", "What was built"],
    "docs/DEPLOYMENT.md": ["Environment variables", "Deploy steps", "Free-tier limits"],
    "docs/DEVICE_ACCEPTANCE_TEST.md": ["A1", "A20"],
    "docs/DEMO_SCRIPT.md": ["Pre-demo checklist", "Timed run", "Plan B"],
    "docs/viva_prep.md": ["Why blendshapes", "argon2id", "Why polling"],
    "docs/report/results.md": ["Verification gates", "Web dashboard UI rubric"],
    "docs/edge_case_coverage.md": ["Cut rows"],
    "docs/FINAL_CHECKLIST.md": ["FINAL CHECKLIST", "Human steps"],
}


def main() -> int:
    failed = False
    for rel, needles in REQUIRED.items():
        path = ROOT / rel
        if not path.exists():
            print(f"ERROR missing doc: {rel}")
            failed = True
            continue
        text = path.read_text()
        for needle in needles:
            if needle not in text:
                print(f"ERROR {rel}: missing section/mention: {needle}")
                failed = True
    if failed:
        print("check_gate8_docs: FAIL")
        return 1
    print("check_gate8_docs: all required docs present with required sections")
    return 0


if __name__ == "__main__":
    sys.exit(main())
