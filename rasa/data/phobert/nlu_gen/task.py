from __future__ import annotations

from typing import Dict, List

from nlu_gen.utils import expand, uniq

TASK_INTENT_ORDER: List[str] = [
    "summarize_week",
    "help_prioritize",
    "filter_tasks",
    "create_task",
    "delete_task",
    "confirm_delete_selection",
    "undo_delete_task",
]


def create_task_examples() -> List[str]:
    prefixes = [
        "tạo công việc",
        "thêm công việc",
        "tạo nhiệm vụ",
        "thêm nhiệm vụ",
        "lập công việc",
        "ghi thêm công việc",
        "tạo việc cần làm",
        "thêm việc cần làm",
    ]
    titles = [
        "viết báo cáo",
        "học truy vấn dữ liệu",
        "xem lại mã nguồn",
        "gọi khách hàng",
        "chuẩn bị bản trình chiếu",
        "làm bài tập",
        "đọc tài liệu",
        "chốt đề xuất",
        "họp nhóm",
        "gửi thư điện tử",
    ]
    dates = [
        "hôm nay",
        "ngày mai",
        "thứ hai tuần tới",
        "cuối tuần này",
        "tuần sau",
    ]
    times = ["9h", "10h30", "14h", "16h", "20h"]
    priorities = ["cao", "trung bình", "thấp", "khẩn cấp", "quan trọng"]

    examples = []
    for prefix in prefixes:
        for title in titles:
            examples.append(f"{prefix} [{title}](task_title)")
            examples.append(f"{prefix} [{title}](task_title) [ngày mai](due_date)")
            examples.append(
                f"{prefix} [{title}](task_title) [ngày mai](due_date) [14h](due_time)"
            )
            examples.append(f"{prefix} [{title}](task_title) ưu tiên [cao](priority)")
            examples.append(f"{prefix} [{title}](task_title) hạn [16h](due_time)")
    for title, date, time, priority in zip(titles, dates, times, priorities):
        examples.append(
            f"tạo công việc [{title}](task_title) vào [{date}](due_date) lúc [{time}](due_time) ưu tiên [{priority}](priority)"
        )
        examples.append(
            f"thêm nhiệm vụ [{title}](task_title) [{date}](due_date) ưu tiên [{priority}](priority)"
        )
    return uniq(examples)


def delete_task_examples() -> List[str]:
    prefixes = [
        "xóa công việc",
        "xoá công việc",
        "xóa nhiệm vụ",
        "xoá nhiệm vụ",
        "xóa việc cần làm",
        "gỡ công việc",
        "bỏ công việc",
        "hủy công việc",
    ]
    titles = [
        "viết báo cáo",
        "học truy vấn dữ liệu",
        "xem lại mã nguồn",
        "gọi khách hàng",
        "chuẩn bị bản trình chiếu",
        "làm bài tập",
        "họp nhóm",
        "gửi thư điện tử",
        "sửa lỗi",
        "mua đồ",
    ]
    examples = []
    for prefix in prefixes:
        for title in titles:
            examples.append(f"{prefix} [{title}](task_title)")
            examples.append(f"{prefix} có tên [{title}](task_title)")
    examples.extend(
        [
            "xóa công việc đầu tiên",
            "xóa công việc cuối cùng",
            "xóa công việc vừa tạo",
            "xóa công việc này",
            "xóa giúp mình công việc đó",
            "bỏ việc đầu tiên",
            "xóa việc này",
            "xóa mục đã chọn",
        ]
    )
    return uniq(examples)


def filter_task_examples() -> List[str]:
    examples = [
        "xem công việc",
        "liệt kê công việc",
        "danh sách công việc",
        "cho tôi xem danh sách công việc",
        "mở danh sách việc cần làm",
        "lọc công việc",
        "tìm công việc",
    ]

    due_states = [
        ("quá hạn", "công việc nào [quá hạn](task_due_state)"),
        ("trễ hạn", "liệt kê công việc [trễ hạn](task_due_state)"),
        ("quá hạn", "xem các việc [quá hạn](task_due_state)"),
        ("đã quá hạn chót", "xem việc [đã quá hạn chót](task_due_state)"),
    ]
    dates = [
        "hôm nay",
        "ngày mai",
        "ngày kia",
        "tuần sau",
        "thứ hai",
        "30/4",
    ]
    statuses = ["chưa làm", "đang làm", "hoàn thành"]
    priorities = ["cao", "trung bình", "thấp"]
    labels = ["công việc", "cá nhân", "học tập", "khách hàng"]
    keywords = ["báo cáo", "cuộc họp", "học bài", "đề xuất", "thư điện tử"]

    examples.extend(template for _label, template in due_states)
    for date in dates:
        examples.extend(
            [
                f"xem công việc [{date}](due_date)",
                f"liệt kê công việc đến hạn [{date}](due_date)",
                f"công việc đến hạn [{date}](due_date)",
            ]
        )
    for status in statuses:
        examples.append(f"lọc công việc trạng thái [{status}](task_status)")
    for priority in priorities:
        examples.append(f"lọc công việc ưu tiên [{priority}](priority)")
    for label in labels:
        examples.append(f"lọc công việc nhãn [{label}](task_label)")
    for keyword in keywords:
        examples.extend(
            [
                f"tìm công việc chứa [{keyword}](search_query)",
                f"lọc công việc có [{keyword}](search_query)",
            ]
        )

    examples.extend(
        [
            "lọc công việc [chưa làm](task_status) ưu tiên [cao](priority)",
            "xem công việc [đang làm](task_status) nhãn [công việc](task_label)",
            "liệt kê công việc [quá hạn](task_due_state) ưu tiên [cao](priority)",
            "xem công việc [ngày mai](due_date) ưu tiên [cao](priority)",
            "tìm công việc chứa [báo cáo](search_query) nhãn [công việc](task_label)",
            "xem các việc [quá hạn](task_due_state) có ưu tiên [cao](priority)",
        ]
    )
    return expand(uniq(examples), 70)


def get_task_intents() -> Dict[str, List[str]]:
    return {
        "summarize_week": expand(
            uniq(
                [
                    "tóm tắt tuần này",
                    "báo cáo tuần",
                    "cho mình tổng kết tuần",
                    "tuần này mình làm được gì",
                    "đánh giá hiệu suất tuần",
                    "tóm lược tuần này",
                    "tổng kết công việc trong tuần",
                    "xem tiến độ tuần này",
                    "kết quả làm việc tuần này",
                    "xem thống kê tuần",
                ]
            ),
            25,
        ),
        "help_prioritize": expand(
            uniq(
                [
                    "ưu tiên việc nào trước",
                    "công việc nào quan trọng nhất",
                    "mình nên làm gì trước",
                    "gợi ý thứ tự công việc",
                    "việc nào cấp bách",
                    "giúp mình sắp xếp ưu tiên công việc",
                    "việc nào cần làm trước tiên",
                    "sắp xếp ưu tiên giúp mình",
                    "chọn công việc cần làm ngay",
                    "đâu là việc nên xử lý trước",
                ]
            ),
            25,
        ),
        "filter_tasks": filter_task_examples(),
        "create_task": create_task_examples()[:65],
        "delete_task": delete_task_examples()[:65],
        "confirm_delete_selection": expand(
            uniq(
                [
                    "xác nhận xóa các công việc đã chọn",
                    "được xóa các công việc đã chọn",
                    "đồng ý xóa danh sách vừa chọn",
                    "xác nhận xóa các mục đã chọn",
                    "xóa hết những công việc đã chọn",
                    "tiếp tục xóa các mục đã chọn",
                    "chắc chắn xóa các công việc này",
                    "xóa các công việc đã đánh dấu",
                    "đúng rồi xóa các mục đã chọn",
                    "tiến hành xóa lựa chọn",
                ]
            ),
            30,
        ),
        "undo_delete_task": expand(
            uniq(
                [
                    "hoàn tác xóa công việc",
                    "khôi phục công việc vừa xóa",
                    "lấy lại công việc vừa xóa",
                    "phục hồi công việc mới xóa",
                    "trả lại công việc đã xóa",
                    "quay lại thao tác xóa công việc",
                    "hủy xóa công việc",
                    "khôi phục mục vừa xóa",
                    "trả lại việc vừa xóa",
                    "lấy lại mục bị xóa",
                ]
            ),
            30,
        ),
    }
