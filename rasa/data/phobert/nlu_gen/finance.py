from __future__ import annotations

from typing import Dict, List


FINANCE_INTENT_ORDER: List[str] = [
    "create_finance_entry",
    "list_finance_entries",
    "search_finance_entries",
    "update_finance_entry",
    "delete_finance_entry",
    "summarize_finance",
    "create_finance_category",
    "list_finance_categories",
    "update_finance_category",
    "delete_finance_category",
]

FINANCE_REGEX = [
    {
        "regex": "finance_amount",
        "examples": [
            r"\d+(?:[.,]\d+)?\s?(?:k|nghìn|ngàn|tr|triệu|m|vnd|đ)?",
        ],
    },
    {
        "regex": "finance_date",
        "examples": [
            "hôm nay",
            "ngày mai",
            "ngày kia",
            "tuần sau",
            "tháng sau",
            r"\d{1,2}/\d{1,2}(?:/\d{2,4})?",
        ],
    },
]


def get_finance_intents() -> Dict[str, List[str]]:
    return {
        "create_finance_entry": [
            "thêm chi tiêu [50000](finance_amount) danh mục [ăn uống](finance_category) mô tả [cơm trưa](finance_description)",
            "ghi nhận chi phí [120k](finance_amount) cho [cà phê với team](finance_description) danh mục [ăn uống](finance_category)",
            "hôm nay tôi tiêu [250000](finance_amount) cho [đổ xăng](finance_description) loại [di chuyển](finance_category)",
            "thêm giao dịch [1.2tr](finance_amount) danh mục [mua sắm](finance_category) nội dung [mua bàn phím](finance_description)",
            "tạo chi phí [85000](finance_amount) ngày [hôm nay](finance_date) cho [ăn tối](finance_description)",
            "add expense [15](finance_amount) category [food](finance_category) description [lunch](finance_description)",
            "record expense [200000](finance_amount) for [grab bike](finance_description) in [di chuyển](finance_category)",
            "lưu chi tiêu [300k](finance_amount) [ngày mai](finance_date) danh mục [hóa đơn](finance_category)",
            "mình vừa chi [45000](finance_amount) mua [trà sữa](finance_description)",
            "thêm khoản chi [700000](finance_amount) cho [tiền điện](finance_description) danh mục [hóa đơn](finance_category)",
            "ghi lại [35000](finance_amount) tiền [gửi xe](finance_description) vào [di chuyển](finance_category)",
            "tạo finance entry [99000](finance_amount) cho [sách](finance_description) category [học tập](finance_category)",
        ],
        "list_finance_entries": [
            "xem chi tiêu gần đây",
            "liệt kê finance",
            "danh sách giao dịch tài chính",
            "xem các khoản chi",
            "mở danh sách chi tiêu",
            "show my expenses",
            "list finance entries",
            "xem chi tiêu [hôm nay](finance_date)",
            "liệt kê khoản chi danh mục [ăn uống](finance_category)",
            "xem giao dịch [ngày mai](finance_date)",
            "cho tôi xem sổ chi tiêu",
            "hiển thị các mục finance mới nhất",
        ],
        "search_finance_entries": [
            "tìm chi tiêu [cà phê](finance_keyword)",
            "tìm khoản chi chứa [grab](finance_keyword)",
            "search expenses for [lunch](finance_keyword)",
            "lọc chi tiêu danh mục [ăn uống](finance_category)",
            "có khoản chi nào về [đổ xăng](finance_keyword)",
            "tìm giao dịch [tiền điện](finance_keyword)",
            "tìm finance [mua sắm](finance_keyword)",
            "xem chi phí liên quan [team](finance_keyword)",
            "lọc finance category [di chuyển](finance_category)",
            "tìm khoản tài chính có [bàn phím](finance_keyword)",
        ],
        "update_finance_entry": [
            "sửa chi tiêu [cà phê](finance_keyword) thành [60000](finance_amount)",
            "cập nhật khoản chi [grab](finance_keyword) danh mục [di chuyển](finance_category)",
            "đổi giao dịch [ăn tối](finance_keyword) thành [120000](finance_amount)",
            "update expense [lunch](finance_keyword) amount [20](finance_amount)",
            "sửa finance [tiền điện](finance_keyword) mô tả [tiền điện tháng này](finance_description)",
            "cập nhật chi phí [trà sữa](finance_keyword) ngày [hôm nay](finance_date)",
            "đổi danh mục khoản chi [bàn phím](finance_keyword) sang [mua sắm](finance_category)",
            "sửa khoản tài chính [đổ xăng](finance_keyword) thành [300000](finance_amount)",
        ],
        "delete_finance_entry": [
            "xóa chi tiêu [cà phê](finance_keyword)",
            "xoá khoản chi [grab](finance_keyword)",
            "delete expense [lunch](finance_keyword)",
            "remove finance entry [tiền điện](finance_keyword)",
            "xóa giao dịch tài chính [trà sữa](finance_keyword)",
            "xoá chi phí danh mục [ăn uống](finance_category)",
            "xóa khoản finance [đổ xăng](finance_keyword)",
            "gỡ mục chi tiêu [bàn phím](finance_keyword)",
        ],
        "summarize_finance": [
            "tổng kết chi tiêu",
            "thống kê tài chính",
            "tháng này tôi tiêu bao nhiêu",
            "tổng chi hôm nay",
            "báo cáo finance",
            "summarize my expenses",
            "finance summary",
            "tổng kết danh mục [ăn uống](finance_category)",
            "thống kê chi tiêu [hôm nay](finance_date)",
            "tính tổng khoản chi",
            "cho tôi báo cáo chi phí",
        ],
        "create_finance_category": [
            "tạo danh mục tài chính [ăn uống](finance_category)",
            "thêm category finance [di chuyển](finance_category)",
            "tạo loại chi tiêu [hóa đơn](finance_category)",
            "add finance category [shopping](finance_category)",
            "thêm danh mục [giải trí](finance_category) cho finance",
        ],
        "list_finance_categories": [
            "xem danh mục tài chính",
            "liệt kê category finance",
            "danh sách loại chi tiêu",
            "show finance categories",
            "xem các danh mục chi tiêu",
        ],
        "update_finance_category": [
            "đổi danh mục [ăn uống](finance_keyword) thành [food](finance_category)",
            "sửa category [di chuyển](finance_keyword) thành [transport](finance_category)",
            "cập nhật danh mục tài chính [hóa đơn](finance_keyword) sang [bills](finance_category)",
            "rename finance category [shopping](finance_keyword) to [mua sắm](finance_category)",
        ],
        "delete_finance_category": [
            "xóa danh mục tài chính [ăn uống](finance_category)",
            "xoá category finance [di chuyển](finance_category)",
            "delete finance category [shopping](finance_category)",
            "remove expense category [hóa đơn](finance_category)",
        ],
    }
