from __future__ import annotations

from typing import Dict, List

from nlu_gen.utils import expand, uniq

SHARED_INTENT_ORDER: List[str] = [
    "greet",
    "goodbye",
    "affirm",
    "deny",
    "ask_howcanhelp",
    "nlu_fallback",
]

SHARED_SYNONYMS = [
    {
        "synonym": "high",
        "examples": [
            "khẩn cấp",
            "rất gấp",
            "cấp bách",
            "quan trọng",
            "gấp",
            "ưu tiên cao",
            "mức cao",
            "cao",
        ],
    },
    {
        "synonym": "low",
        "examples": [
            "không gấp",
            "ít gấp",
            "để sau cũng được",
            "ưu tiên thấp",
            "mức thấp",
            "bình thường thôi",
            "khi nào cũng được",
            "thấp",
        ],
    },
    {
        "synonym": "medium",
        "examples": [
            "bình thường",
            "vừa phải",
            "mức vừa",
            "ưu tiên vừa",
            "trung mức",
            "trung bình",
        ],
    },
]

SHARED_REGEX = [
    {
        "regex": "due_time",
        "examples": [
            r"\d{1,2}h\d{0,2}",
            r"\d{1,2}:\d{2}",
            r"\d{1,2}(am|pm)",
            r"\d{1,2} giờ",
            r"\d{1,2}h sáng",
            r"\d{1,2}h chiều",
        ],
    },
    {
        "regex": "due_date",
        "examples": [
            "hôm nay",
            "ngày mai",
            "ngày kia",
            "thứ hai tuần tới",
            "tuần sau",
            "tháng sau",
            "chiều nay",
            "tối nay",
            "sáng mai",
        ],
    },
]


def get_shared_intents() -> Dict[str, List[str]]:
    return {
        "greet": expand(
            uniq(
                [
                    "xin chào",
                    "chào bạn",
                    "chào nhé",
                    "chào nha",
                    "alo",
                    "chào buổi sáng",
                    "chào buổi tối",
                    "mình cần hỗ trợ",
                    "chào trợ lý",
                ]
            ),
            25,
        ),
        "goodbye": expand(
            uniq(
                [
                    "tạm biệt",
                    "chào tạm biệt",
                    "tạm biệt nhé",
                    "mình chào bạn nha",
                    "hẹn gặp lại",
                    "mình thoát nhé",
                    "kết thúc ở đây",
                    "cảm ơn nhé tạm biệt",
                    "mình đi đây",
                    "hẹn gặp lại sau",
                ]
            ),
            25,
        ),
        "affirm": expand(
            uniq(
                [
                    "đúng rồi",
                    "đồng ý",
                    "được",
                    "ừ",
                    "vâng",
                    "chính xác",
                    "xác nhận",
                    "được",
                    "chuẩn",
                    "ừ đúng",
                ]
            ),
            25,
        ),
        "deny": expand(
            uniq(
                [
                    "không",
                    "không đồng ý",
                    "hủy",
                    "thôi",
                    "không nhé",
                    "không phải",
                    "bỏ qua",
                    "đừng làm vậy",
                    "không cần",
                    "dừng lại",
                ]
            ),
            25,
        ),
        "ask_howcanhelp": expand(
            uniq(
                [
                    "bạn giúp được gì",
                    "bạn làm được gì",
                    "mình cần hướng dẫn",
                    "hỗ trợ mình với",
                    "tôi có thể nhờ gì",
                    "bạn hỗ trợ được những gì",
                    "bạn có thể giúp mình ra sao",
                    "giúp mình với",
                    "liệt kê chức năng của bạn",
                    "bạn hỗ trợ tác vụ nào",
                ]
            ),
            30,
        ),
        "nlu_fallback": uniq(
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
                "hoàn tác",
                "ngày mai",
                "công việc",
                "điều gì đó",
                "hmmmmm",
                "kkkk",
                "văn bản linh tinh",
                "không liên quan",
                "chữ vô nghĩa",
                "lorem ipsum",
            ]
        )[:20],
    }
