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
    intents = {}
    intents["greet"] = expand(
        uniq(
            [
                "xin chào",
                "chào bạn",
                "hello",
                "hi",
                "alo",
                "chào buổi sáng",
                "chào buổi tối",
                "mình cần hỗ trợ",
                "chào trợ lý",
            ]
        ),
        25,
    )
    intents["goodbye"] = expand(
        uniq(
            [
                "tạm biệt",
                "chào tạm biệt",
                "bye",
                "goodbye",
                "hẹn gặp lại",
                "mình thoát nhé",
                "kết thúc ở đây",
                "cảm ơn nhé tạm biệt",
                "mình đi đây",
                "see you",
            ]
        ),
        25,
    )
    intents["affirm"] = expand(
        uniq(
            [
                "đúng rồi",
                "đồng ý",
                "ok",
                "oke",
                "yes",
                "chính xác",
                "xác nhận",
                "được",
                "chuẩn",
                "ừ đúng",
            ]
        ),
        25,
    )
    intents["deny"] = expand(
        uniq(
            [
                "không",
                "không đồng ý",
                "hủy",
                "thôi",
                "no",
                "không phải",
                "bỏ qua",
                "đừng làm vậy",
                "không cần",
                "stop",
            ]
        ),
        25,
    )
    intents["ask_howcanhelp"] = expand(
        uniq(
            [
                "bạn giúp được gì",
                "bạn làm được gì",
                "mình cần hướng dẫn",
                "hỗ trợ mình với",
                "tôi có thể nhờ gì",
                "show me what you can do",
                "how can you help",
                "help me",
                "liệt kê chức năng của bạn",
                "bạn hỗ trợ tác vụ nào",
            ]
        ),
        30,
    )
    intents["list_overdue_tasks"] = expand(
        uniq(
            [
                "task nào quá hạn",
                "liệt kê task quá hạn",
                "xem công việc quá hạn",
                "có task nào trễ hạn không",
                "cho tôi danh sách quá hạn",
                "show overdue tasks",
                "overdue tasks list",
                "nhiệm vụ nào đã trễ",
                "xem việc đã quá deadline",
                "task trễ hạn hôm nay",
            ]
        ),
        25,
    )
    intents["list_tasks_by_date"] = expand(
        uniq(
            [
                "xem task hôm nay",
                "xem task ngày mai",
                "liệt kê task thứ hai",
                "xem việc ngày kia",
                "task ngày 30/4",
                "công việc đến hạn ngày mai",
                "show tasks for tomorrow",
                "tasks due today",
                "xem task tuần sau",
                "liệt kê task theo ngày",
            ]
        ),
        25,
    )
    intents["summarize_week"] = expand(
        uniq(
            [
                "tóm tắt tuần này",
                "báo cáo tuần",
                "cho mình tổng kết tuần",
                "tuần này mình làm được gì",
                "đánh giá hiệu suất tuần",
                "weekly summary",
                "summarize my week",
                "show week progress",
                "kết quả làm việc tuần này",
                "xem thống kê tuần",
            ]
        ),
        25,
    )
    intents["help_prioritize"] = expand(
        uniq(
            [
                "ưu tiên việc nào trước",
                "task nào quan trọng nhất",
                "mình nên làm gì trước",
                "gợi ý thứ tự công việc",
                "việc nào cấp bách",
                "prioritize my tasks",
                "what is most important",
                "sắp xếp ưu tiên giúp mình",
                "chọn task cần làm ngay",
                "đâu là việc nên xử lý trước",
            ]
        ),
        25,
    )
    intents["create_task"] = create_task_examples()[:65]
    intents["delete_task"] = delete_task_examples()[:65]
    intents["confirm_delete_selection"] = expand(
        uniq(
            [
                "xác nhận xóa các task đã chọn",
                "ok xóa các task đã chọn",
                "đồng ý xóa danh sách vừa chọn",
                "confirm delete selected tasks",
                "xóa hết những task đã chọn",
                "tiếp tục xóa các mục đã chọn",
                "chắc chắn xóa các task này",
                "xóa các task đã đánh dấu",
                "yes delete selected tasks",
                "tiến hành xóa lựa chọn",
            ]
        ),
        30,
    )
    intents["undo_delete_task"] = expand(
        uniq(
            [
                "hoàn tác xóa task",
                "undo xóa task",
                "khôi phục task vừa xóa",
                "lấy lại task vừa xóa",
                "undo delete task",
                "phục hồi task mới xóa",
                "trả lại task đã xóa",
                "rollback thao tác xóa task",
                "hủy xóa task",
                "restore deleted task",
            ]
        ),
        30,
    )
    create_n, list_n, search_n, pin_n, update_n, delete_n = note_examples()
    intents["create_note"] = expand(create_n, 30)
    intents["list_notes"] = expand(list_n, 30)
    intents["search_notes"] = expand(search_n, 30)
    intents["pin_note"] = expand(pin_n, 30)
    intents["update_note"] = expand(update_n, 30)
    intents["delete_note"] = expand(delete_n, 30)
    intents["nlu_fallback"] = uniq(
        [
            "asdf",
            "qwerty",
            "zxczxc",
            "aaaabbbb",
            "123123",
            "???",
            "....",
            "ơ ơ ơ",
            "blabla",
            "xóa",
            "undo",
            "ngày mai",
            "task",
            "điều gì đó",
            "hmmmmm",
            "kkkk",
            "random text",
            "không liên quan",
            "gibberish input",
            "lorem ipsum",
        ]
    )[:20]
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
        "list_overdue_tasks",
        "list_tasks_by_date",
        "summarize_week",
        "help_prioritize",
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
    intents = build_dataset()
    nlu_text = render_nlu(intents)
    NLU_PATH.write_text(nlu_text, encoding="utf-8")

    rows = build_intent_train(intents)
    INTENT_TRAIN_PATH.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    quality_report(rows)


if __name__ == "__main__":
    main()
