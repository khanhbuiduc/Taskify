import json
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
NLU_PATH = ROOT / "data" / "nlu.yml"
INTENT_TRAIN_PATH = ROOT / "data" / "phobert" / "intent_train.json"


def uniq(items):
    seen = set()
    out = []
    for item in items:
        key = item.strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(key)
    return out


def create_task_examples():
    prefixes = [
        "tạo task",
        "thêm task",
        "tạo nhiệm vụ",
        "thêm nhiệm vụ",
        "tạo công việc",
        "thêm công việc",
        "create task",
        "add task",
    ]
    titles = [
        "viết báo cáo",
        "học sql",
        "review code",
        "gọi khách hàng",
        "chuẩn bị slide",
        "làm bài tập",
        "đọc tài liệu",
        "chốt proposal",
        "họp team",
        "gửi email",
    ]
    dates = [
        "hôm nay",
        "ngày mai",
        "thứ hai tuần sau",
        "cuối tuần này",
        "tuần sau",
    ]
    times = ["9h", "10h30", "14h", "16h", "20h"]
    priorities = ["cao", "trung bình", "thấp", "khẩn cấp", "quan trọng"]

    examples = []
    for p in prefixes:
        for t in titles:
            examples.append(f"{p} [{t}](task_title)")
            examples.append(f"{p} [{t}](task_title) [ngày mai](due_date)")
            examples.append(f"{p} [{t}](task_title) [ngày mai](due_date) [14h](due_time)")
            examples.append(f"{p} [{t}](task_title) ưu tiên [cao](priority)")
            examples.append(f"{p} [{t}](task_title) hạn [16h](due_time)")
    for t, d, ti, pr in zip(titles, dates, times, priorities):
        examples.append(
            f"tạo task [{t}](task_title) vào [{d}](due_date) lúc [{ti}](due_time) ưu tiên [{pr}](priority)"
        )
        examples.append(
            f"thêm nhiệm vụ [{t}](task_title) [{d}](due_date) ưu tiên [{pr}](priority)"
        )
    return uniq(examples)


def delete_task_examples():
    prefixes = [
        "xóa task",
        "xoá task",
        "xóa nhiệm vụ",
        "xoá nhiệm vụ",
        "xóa công việc",
        "remove task",
        "delete task",
        "gỡ task",
    ]
    titles = [
        "viết báo cáo",
        "học sql",
        "review code",
        "gọi khách hàng",
        "chuẩn bị slide",
        "làm bài tập",
        "họp team",
        "gửi email",
        "fix bug",
        "mua đồ",
    ]
    examples = []
    for p in prefixes:
        for t in titles:
            examples.append(f"{p} [{t}](task_title)")
            examples.append(f"{p} có tên [{t}](task_title)")
    examples.extend(
        [
            "xóa task đầu tiên",
            "xóa task cuối cùng",
            "xóa task vừa tạo",
            "xóa task này",
            "xóa giúp mình task đó",
            "remove the first task",
            "delete this task",
            "delete selected task",
        ]
    )
    return uniq(examples)


def filter_task_examples():
    """Canonical task query intent.

    Keep all list/search/filter variants under one intent and express the
    difference through entities/slots: task_due_state, due_date, task_status,
    priority, task_label, and search_query.
    """
    examples = [
        "xem task",
        "liệt kê task",
        "danh sách công việc",
        "show tasks",
        "list my tasks",
        "lọc task",
        "tìm task",
    ]

    due_states = [
        ("quá hạn", "task nào [quá hạn](task_due_state)"),
        ("trễ hạn", "liệt kê task [trễ hạn](task_due_state)"),
        ("overdue", "show [overdue](task_due_state) tasks"),
        ("đã quá deadline", "xem việc [đã quá deadline](task_due_state)"),
    ]
    dates = [
        "hôm nay",
        "ngày mai",
        "ngày kia",
        "tuần sau",
        "thứ hai",
        "30/4",
    ]
    statuses = ["todo", "in-progress", "completed", "chưa làm", "đang làm", "hoàn thành"]
    priorities = ["cao", "trung bình", "thấp", "high", "medium", "low"]
    labels = ["work", "personal", "học tập", "khách hàng"]
    keywords = ["báo cáo", "meeting", "sql", "proposal", "email"]

    examples.extend(template for _label, template in due_states)
    for date in dates:
        examples.extend(
            [
                f"xem task [{date}](due_date)",
                f"liệt kê công việc đến hạn [{date}](due_date)",
                f"task due [{date}](due_date)",
            ]
        )
    for status in statuses:
        examples.append(f"lọc task trạng thái [{status}](task_status)")
    for priority in priorities:
        examples.append(f"lọc task ưu tiên [{priority}](priority)")
    for label in labels:
        examples.append(f"lọc task nhãn [{label}](task_label)")
    for keyword in keywords:
        examples.extend(
            [
                f"tìm task chứa [{keyword}](search_query)",
                f"filter tasks contains [{keyword}](search_query)",
            ]
        )

    examples.extend(
        [
            "lọc task [todo](task_status) ưu tiên [cao](priority)",
            "xem task [đang làm](task_status) nhãn [work](task_label)",
            "liệt kê task [quá hạn](task_due_state) ưu tiên [high](priority)",
            "xem task [ngày mai](due_date) ưu tiên [cao](priority)",
            "tìm task chứa [báo cáo](search_query) nhãn [work](task_label)",
            "show [overdue](task_due_state) tasks with [high](priority) priority",
        ]
    )
    return expand(uniq(examples), 70)


def note_examples():
    create = uniq(
        [
            "tạo note [ý tưởng sprint](note_title)",
            "thêm ghi chú [shopping list](note_title)",
            "tạo note [họp tuần](note_title) nội dung [chốt deadline](note_text)",
            "ghi chú [học rasa](note_title)",
            "tạo ghi chú nhanh [fix bug list](note_title)",
            "create note [project ideas](note_title)",
            "add note [meeting notes](note_title)",
            "new note [retro](note_title)",
            "tạo note [kế hoạch tuần](note_title)",
            "thêm note [đọc sách](note_title)",
        ]
    )
    list_n = uniq(
        [
            "xem danh sách note",
            "liệt kê ghi chú",
            "cho tôi xem note",
            "xem note gần đây",
            "xem note đã ghim",
            "list notes",
            "show my notes",
            "show pinned notes",
            "mở danh sách ghi chú",
            "hiển thị toàn bộ note",
        ]
    )
    search = uniq(
        [
            "tìm note về [kế hoạch](note_keyword)",
            "tìm ghi chú chứa [bug](note_keyword)",
            "search notes for [idea](note_keyword)",
            "find notes about [meeting](note_keyword)",
            "có note nào chứa [retro](note_keyword)",
            "lọc note theo [shopping](note_keyword)",
            "tìm note [rasa](note_keyword)",
            "tìm giúp mình ghi chú [deadline](note_keyword)",
            "search note keyword [project](note_keyword)",
            "kiểm tra note có [sql](note_keyword)",
        ]
    )
    pin = uniq(
        [
            "ghim note này",
            "bỏ ghim note này",
            "ghim note vừa tạo",
            "hủy ghim note đó",
            "pin this note",
            "unpin this note",
            "pin note [shopping list](note_title)",
            "unpin note [retro](note_title)",
            "ghim ghi chú [họp tuần](note_title)",
            "bỏ ghim ghi chú [ý tưởng sprint](note_title)",
        ]
    )
    update = uniq(
        [
            "sửa note [họp tuần](note_keyword)",
            "cập nhật note [meeting](note_keyword) thành [meeting v2](note_title)",
            "thay đổi note [idea](note_keyword) nội dung [triển khai giai đoạn 2](note_text)",
            "update note [retro](note_keyword)",
            "edit note [project ideas](note_keyword)",
            "sửa ghi chú [shopping list](note_keyword)",
            "cập nhật ghi chú [kế hoạch](note_keyword)",
            "update note title [họp team](note_title)",
            "thay nội dung note [bug list](note_keyword) thành [fix payment bug](note_text)",
            "sửa note [rasa](note_keyword)",
        ]
    )
    delete = uniq(
        [
            "xóa note [shopping](note_keyword)",
            "xoá note [họp tuần](note_keyword)",
            "xóa ghi chú [nháp](note_keyword)",
            "delete note [meeting notes](note_keyword)",
            "remove note [idea](note_keyword)",
            "xóa note tên [bug list](note_keyword)",
            "xóa giúp mình note [kế hoạch](note_keyword)",
            "delete this note [retro](note_keyword)",
            "remove note [project ideas](note_keyword)",
            "xoá ghi chú [rasa](note_keyword)",
        ]
    )
    return create, list_n, search, pin, update, delete


def expand(base, target):
    out = list(base)
    i = 0
    while len(out) < target:
        seed = base[i % len(base)]
        suffix = [
            " giúp mình",
            " nha",
            " ngay",
            " với",
            " đi",
            " cho tôi",
            " nhé",
            " liền",
        ][i % 8]
        out.append(f"{seed}{suffix}")
        i += 1
    return uniq(out)[:target]


def build_dataset():
    from nlu_gen.finance import get_finance_intents
    from nlu_gen.note import get_note_intents
    from nlu_gen.shared import get_shared_intents
    from nlu_gen.task import get_task_intents

    intents = {}
    intents.update(get_shared_intents())
    intents.update(get_task_intents())
    intents.update(get_note_intents())
    intents.update(get_finance_intents())
    return intents


def render_nlu(intents):
    lines = [
        '# NLU training data for Taskify assistant (Vietnamese-first)',
        'version: "3.1"',
        "",
        "nlu:",
    ]
    ordered = [
        "greet",
        "goodbye",
        "affirm",
        "deny",
        "ask_howcanhelp",
        "summarize_week",
        "help_prioritize",
        "filter_tasks",
        "create_task",
        "delete_task",
        "confirm_delete_selection",
        "undo_delete_task",
        "create_note",
        "list_notes",
        "search_notes",
        "pin_note",
        "update_note",
        "delete_note",
        "nlu_fallback",
    ]
    for intent in ordered:
        lines.append(f"  - intent: {intent}")
        lines.append("    examples: |")
        for ex in intents[intent]:
            lines.append(f"      - {ex}")
        lines.append("")

    lines.extend(
        [
            "  - synonym: high",
            "    examples: |",
            "      - urgent",
            "      - critical",
            "      - important",
            "      - asap",
            "      - high priority",
            "      - khẩn cấp",
            "      - quan trọng",
            "      - gấp",
            "      - ưu tiên cao",
            "      - cao",
            "",
            "  - synonym: low",
            "    examples: |",
            "      - minor",
            "      - not urgent",
            "      - whenever",
            "      - low priority",
            "      - không gấp",
            "      - ưu tiên thấp",
            "      - khi nào cũng được",
            "      - thấp",
            "",
            "  - synonym: medium",
            "    examples: |",
            "      - normal",
            "      - regular",
            "      - standard",
            "      - medium priority",
            "      - bình thường",
            "      - trung bình",
            "",
            "  - regex: due_time",
            "    examples: |",
            "      - \\d{1,2}h\\d{0,2}",
            "      - \\d{1,2}:\\d{2}",
            "      - \\d{1,2}(am|pm)",
            "      - \\d{1,2} giờ",
            "      - \\d{1,2}h sáng",
            "      - \\d{1,2}h chiều",
            "",
            "  - regex: due_date",
            "    examples: |",
            "      - today",
            "      - tomorrow",
            "      - next monday",
            "      - next week",
            "      - hôm nay",
            "      - ngày mai",
            "      - ngày kia",
            "      - tuần sau",
            "      - tháng sau",
            "      - chiều nay",
            "      - tối nay",
            "      - sáng mai",
            "",
        ]
    )
    return "\n".join(lines).strip() + "\n"


def normalize_text(text):
    cleaned = re.sub(r"\[(.*?)\]\((.*?)\)", r"\1", text)
    cleaned = cleaned.lower().strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def build_intent_train(intents):
    rows = []
    for intent, examples in intents.items():
        for ex in examples:
            rows.append({"text": normalize_text(ex), "intent": intent})
    return rows


def quality_report(rows):
    by_intent = defaultdict(list)
    for row in rows:
        by_intent[row["intent"]].append(row["text"])

    print("intent counts:")
    for intent, vals in sorted(by_intent.items(), key=lambda kv: (len(kv[1]), kv[0])):
        print(f"  {intent}: {len(vals)}")

    norm_map = defaultdict(set)
    for row in rows:
        norm = re.sub(r"[?!.,:;\"']", "", row["text"])
        norm = re.sub(r"\s+", " ", norm).strip()
        norm_map[norm].add(row["intent"])
    overlaps = {k: v for k, v in norm_map.items() if len(v) > 1}
    print(f"normalized cross-intent overlap: {len(overlaps)}")

    dups = 0
    seen = set()
    for row in rows:
        key = (row["intent"], row["text"])
        if key in seen:
            dups += 1
        seen.add(key)
    print(f"exact duplicates (same intent): {dups}")


def main():
    from generate_nlu import main as generate_split_nlu

    print(
        "refactor_nlu_v2.py is deprecated. Generating split domain files via generate_nlu.py ..."
    )
    generate_split_nlu()

    intents = build_dataset()
    rows = build_intent_train(intents)
    INTENT_TRAIN_PATH.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    quality_report(rows)


if __name__ == "__main__":
    main()
