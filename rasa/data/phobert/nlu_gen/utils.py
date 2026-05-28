from __future__ import annotations

from typing import Iterable, List


def uniq(items: Iterable[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for item in items:
        key = item.strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(key)
    return out


def expand(base: List[str], target: int) -> List[str]:
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
