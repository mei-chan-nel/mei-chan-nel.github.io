from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


DEFAULT_PORTAL_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_APP_ROOT = DEFAULT_PORTAL_ROOT.parent / "info1-quiz-app"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the integrated validation suite against explicit Study Atlas checkouts."
    )
    parser.add_argument(
        "--portal-root",
        type=Path,
        default=DEFAULT_PORTAL_ROOT,
        help="Path to the mei-chan-nel.github.io checkout.",
    )
    parser.add_argument(
        "--app-root",
        type=Path,
        default=DEFAULT_APP_ROOT,
        help="Path to the info1-quiz-app checkout.",
    )
    parser.add_argument(
        "--portal-ref",
        help="Optional Git ref that must resolve to the portal checkout's current HEAD.",
    )
    parser.add_argument(
        "--app-ref",
        help="Optional Git ref that must resolve to the app checkout's current HEAD.",
    )
    return parser.parse_args()


def run_capture(repo: Path, *args: str) -> str:
    completed = subprocess.run(
        [*args],
        cwd=repo,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return completed.stdout.strip()


def repository_metadata(label: str, repo: Path, expected_ref: str | None) -> None:
    try:
        inside_work_tree = run_capture(repo, "git", "rev-parse", "--is-inside-work-tree")
    except (OSError, subprocess.CalledProcessError) as exc:
        raise RuntimeError(f"{label}: not a readable Git checkout: {repo}") from exc
    if inside_work_tree != "true":
        raise RuntimeError(f"{label}: not a Git work tree: {repo}")

    head = run_capture(repo, "git", "rev-parse", "HEAD")
    branch = run_capture(repo, "git", "branch", "--show-current") or "(detached HEAD)"
    repository_name = repo.name
    remote = run_capture(repo, "git", "remote", "get-url", "origin") if run_capture(repo, "git", "remote") else "(none)"
    dirty = bool(run_capture(repo, "git", "status", "--porcelain"))

    print(f"[{label}] repository={repository_name}")
    print(f"[{label}] path={repo}")
    print(f"[{label}] branch={branch}")
    print(f"[{label}] head={head}")
    print(f"[{label}] remote={remote}")
    print(f"[{label}] dirty={'yes' if dirty else 'no'}")

    if expected_ref:
        try:
            expected_sha = run_capture(repo, "git", "rev-parse", "--verify", f"{expected_ref}^{{commit}}")
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(f"{label}: Git ref does not resolve: {expected_ref}") from exc
        print(f"[{label}] expected_ref={expected_ref} ({expected_sha})")
        if expected_sha != head:
            raise RuntimeError(
                f"{label}: HEAD {head} does not match requested ref {expected_ref} ({expected_sha})"
            )


def run_step(label: str, cwd: Path, command: list[str]) -> None:
    print(f"\n== {label} ==")
    completed = subprocess.run(command, cwd=cwd)
    if completed.returncode:
        raise RuntimeError(f"{label} failed with exit code {completed.returncode}")


def main() -> int:
    args = parse_args()
    portal_root = args.portal_root.expanduser().resolve()
    app_root = args.app_root.expanduser().resolve()

    try:
        repository_metadata("portal", portal_root, args.portal_ref)
        repository_metadata("app", app_root, args.app_ref)

        run_step(
            "lecture data consistency",
            portal_root,
            ["node", "scripts/build_lecture_data.mjs", "--check"],
        )
        run_step(
            "lecture page consistency",
            portal_root,
            ["node", "scripts/build_lecture_pages.mjs", "--check"],
        )
        run_step(
            "portal validation",
            portal_root,
            [
                sys.executable,
                "scripts/validate_portal.py",
                "--app-root",
                str(app_root),
            ],
        )
        run_step(
            "question classification",
            app_root,
            [sys.executable, "scripts/classify_questions.py", "--check"],
        )
        run_step(
            "question and app validation",
            app_root,
            [
                sys.executable,
                "scripts/validate_question_pages.py",
                "--portal-root",
                str(portal_root),
            ],
        )
        test_files = sorted((app_root / "scripts").glob("*.test.mjs"))
        run_step(
            "JavaScript tests",
            app_root,
            ["node", "--test", *(str(path.relative_to(app_root)) for path in test_files)],
        )
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print("\nIntegrated Study Atlas validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
