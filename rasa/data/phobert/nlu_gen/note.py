from __future__ import annotations

from typing import Dict, List

from nlu_gen.utils import expand, uniq

NOTE_INTENT_ORDER: List[str] = [
    "create_note",
    "list_notes",
    "search_notes",
    "pin_note",
    "update_note",
    "delete_note",
]


def note_examples():
    create = uniq(
        [
            "tạo ghi chú [ý tưởng đợt làm việc](note_title)",
            "thêm ghi chú [danh sách mua sắm](note_title)",
            "tạo ghi chú [họp tuần](note_title) nội dung [chốt hạn cuối](note_text)",
            "ghi chú [học rasa](note_title)",
            "tạo ghi chú nhanh [danh sách lỗi cần sửa](note_title)",
            "tạo ghi chú [ý tưởng dự án](note_title)",
            "thêm ghi chú [nội dung cuộc họp](note_title)",
            "tạo ghi chú [tổng kết tuần](note_title)",
            "tạo ghi chú [kế hoạch tuần](note_title)",
            "thêm ghi chú [đọc sách](note_title)",
        ]
    )
    list_notes = uniq(
        [
            "xem danh sách ghi chú",
            "liệt kê ghi chú",
            "cho tôi xem ghi chú",
            "xem ghi chú gần đây",
            "xem ghi chú đã ghim",
            "mở các ghi chú của tôi",
            "hiển thị các ghi chú đã lưu",
            "cho xem các ghi chú đã ghim",
            "mở danh sách ghi chú",
            "hiển thị toàn bộ ghi chú",
        ]
    )
    search = uniq(
        [
            "tìm ghi chú về [kế hoạch](note_keyword)",
            "tìm ghi chú chứa [lỗi](note_keyword)",
            "tìm ghi chú có [ý tưởng](note_keyword)",
            "tìm ghi chú về [cuộc họp](note_keyword)",
            "có ghi chú nào chứa [tổng kết](note_keyword)",
            "lọc ghi chú theo [mua sắm](note_keyword)",
            "tìm ghi chú [rasa](note_keyword)",
            "tìm giúp mình ghi chú [hạn chót](note_keyword)",
            "tìm ghi chú với từ khóa [dự án](note_keyword)",
            "kiểm tra ghi chú có [truy vấn](note_keyword)",
        ]
    )
    pin = uniq(
        [
            "ghim ghi chú này",
            "bỏ ghim ghi chú này",
            "ghim ghi chú vừa tạo",
            "hủy ghim ghi chú đó",
            "ghim ghi chú [danh sách mua sắm](note_title)",
            "bỏ ghim ghi chú [tổng kết tuần](note_title)",
            "ghim ghi chú [họp tuần](note_title)",
            "bỏ ghim ghi chú [ý tưởng đợt làm việc](note_title)",
            "giữ ghi chú này ở đầu danh sách",
            "bỏ giữ ghi chú này ở đầu danh sách",
        ]
    )
    update = uniq(
        [
            "sửa ghi chú [họp tuần](note_keyword)",
            "cập nhật ghi chú [cuộc họp](note_keyword) thành [họp tuần bản mới](note_title)",
            "thay đổi ghi chú [ý tưởng](note_keyword) nội dung [triển khai giai đoạn 2](note_text)",
            "cập nhật ghi chú [tổng kết](note_keyword)",
            "chỉnh sửa ghi chú [ý tưởng dự án](note_keyword)",
            "sửa ghi chú [danh sách mua sắm](note_keyword)",
            "cập nhật ghi chú [kế hoạch](note_keyword)",
            "cập nhật tiêu đề ghi chú [họp nhóm](note_title)",
            "thay nội dung ghi chú [danh sách lỗi](note_keyword) thành [sửa lỗi thanh toán](note_text)",
            "sửa ghi chú [rasa](note_keyword)",
        ]
    )
    delete = uniq(
        [
            "xóa ghi chú [mua sắm](note_keyword)",
            "xoá ghi chú [họp tuần](note_keyword)",
            "xóa ghi chú [nháp](note_keyword)",
            "xóa ghi chú [nội dung cuộc họp](note_keyword)",
            "bỏ ghi chú [ý tưởng](note_keyword)",
            "xóa ghi chú tên [danh sách lỗi](note_keyword)",
            "xóa giúp mình ghi chú [kế hoạch](note_keyword)",
            "xóa ghi chú [tổng kết tuần](note_keyword)",
            "bỏ ghi chú [ý tưởng dự án](note_keyword)",
            "xoá ghi chú [rasa](note_keyword)",
        ]
    )
    return create, list_notes, search, pin, update, delete


def get_note_intents() -> Dict[str, List[str]]:
    create, list_notes, search, pin, update, delete = note_examples()
    return {
        "create_note": expand(create, 30),
        "list_notes": expand(list_notes, 30),
        "search_notes": expand(search, 30),
        "pin_note": expand(pin, 30),
        "update_note": expand(update, 30),
        "delete_note": expand(delete, 30),
    }
