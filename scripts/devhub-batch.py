#!/usr/bin/env python3
"""Local DevHub CSV batch bridge.

The script intentionally uses only Python's standard library. It reads a real
CSV file, emits JSON-line session/task events, and attempts a Windows named-pipe
connection when DevHub supplies --pipe. If the pipe is unavailable it falls back
to stdout so DevHub can still observe the child process without fabricating
success.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import queue
import sys
import threading
import time
from pathlib import Path
from typing import Any, BinaryIO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a DevHub CSV batch bridge")
    parser.add_argument("--csv", required=True, dest="csv_path")
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--pipe", default="")
    parser.add_argument("--concurrent", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def open_pipe(path: str) -> BinaryIO | None:
    if not path:
        return None
    deadline = time.monotonic() + 0.75
    while time.monotonic() < deadline:
        try:
            return open(path, "r+b", buffering=0)
        except OSError:
            time.sleep(0.05)
    return None


class ControlState:
    def __init__(self, initially_paused: bool, control_reader: BinaryIO | None = None) -> None:
        self.control_reader = control_reader
        self.paused = threading.Event()
        self.stop = threading.Event()
        self.events: queue.Queue[dict[str, Any]] = queue.Queue()
        if initially_paused:
            self.paused.set()


def emit(writer: BinaryIO | None, event_type: str, payload: dict[str, Any], lock: threading.Lock | None = None) -> None:
    message = json.dumps({"type": event_type, "payload": payload}, ensure_ascii=False, separators=(",", ":")) + "\n"
    if writer is not None:
        if lock is None:
            writer.write(message.encode("utf-8"))
            writer.flush()
        else:
            with lock:
                writer.write(message.encode("utf-8"))
                writer.flush()
        return
    sys.stdout.write(message)
    sys.stdout.flush()


def parse_control_line(raw: bytes) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def start_control_reader(control_path: str, writer: BinaryIO | None, session_id: str, output_lock: threading.Lock | None) -> ControlState:
    control_reader = open_pipe(control_path) if writer is not None and control_path else None
    state = ControlState(initially_paused=control_reader is not None, control_reader=control_reader)
    if writer is None or control_reader is None:
        return state

    def run() -> None:
        try:
            while not state.stop.is_set():
                try:
                    control = parse_control_line(control_reader.readline())
                except OSError:
                    return
                if control is None:
                    return
                action = control.get("action")
                if action == "pause":
                    state.paused.set()
                elif action == "resume":
                    state.paused.clear()
                else:
                    action = "unknown"
                state.events.put({"action": action, "sessionId": session_id})
                emit(writer, "control-ack", {
                    "sessionId": session_id,
                    "action": action,
                    "transport": "named-pipe",
                }, output_lock)
        finally:
            control_reader.close()

    threading.Thread(target=run, name=f"devhub-csv-control-{session_id}", daemon=True).start()
    return state


def wait_if_paused(state: ControlState) -> None:
    while state.paused.is_set() and not state.stop.is_set():
        time.sleep(0.05)


def row_delay_seconds() -> float:
    raw = os.environ.get("DEVHUB_CSV_PYTHON_ROW_DELAY_MS", "0")
    try:
        delay_ms = int(raw)
    except ValueError:
        delay_ms = 0
    return max(0, min(delay_ms, 5000)) / 1000


def read_rows(csv_path: Path) -> list[dict[str, str]]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        filtered_lines = (line for line in handle if not line.lstrip().startswith("#"))
        return list(csv.DictReader(filtered_lines))


def main() -> int:
    args = parse_args()
    csv_path = Path(args.csv_path).resolve()
    writer = open_pipe(args.pipe)
    output_lock = threading.Lock() if writer is not None else None
    control_state = start_control_reader(args.pipe, writer, args.session_id, output_lock)
    per_row_delay = row_delay_seconds()
    try:
        rows = read_rows(csv_path)
        emit(writer, "session-start", {
            "sessionId": args.session_id,
            "csvPath": str(csv_path),
            "runner": "python",
            "totalRows": len(rows),
            "concurrent": args.concurrent,
            "dryRun": args.dry_run,
            "transport": "named-pipe" if writer is not None else "stdout-jsonl",
        }, output_lock)
        total = max(len(rows), 1)
        for index, row in enumerate(rows):
            wait_if_paused(control_state)
            task_id = row.get("taskId") or f"row-{index + 1}"
            emit(writer, "task-start", {
                "sessionId": args.session_id,
                "taskId": task_id,
                "index": index,
                "total": len(rows),
                "tool": row.get("tool") or "unknown",
                "dryRun": args.dry_run,
            }, output_lock)
            emit(writer, "task-progress", {
                "sessionId": args.session_id,
                "taskId": task_id,
                "percent": min((index + 1) / total, 1.0),
            }, output_lock)
            if per_row_delay > 0:
                time.sleep(per_row_delay)
        emit(writer, "session-end", {
            "sessionId": args.session_id,
            "status": "dry-run" if args.dry_run else "prepared",
            "totalRows": len(rows),
            "transport": "named-pipe" if writer is not None else "stdout-jsonl",
        }, output_lock)
        return 0
    except Exception as exc:
        emit(writer, "session-error", {
            "sessionId": args.session_id,
            "error": str(exc),
        }, output_lock)
        return 1
    finally:
        control_state.stop.set()
        if control_state.control_reader is not None:
            control_state.control_reader.close()
        if writer is not None:
            writer.close()


if __name__ == "__main__":
    raise SystemExit(main())
