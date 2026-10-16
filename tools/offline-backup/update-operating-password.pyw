"""User enters a rotated DB password locally. Updates the existing private file only."""
import json
import os
from pathlib import Path
import tkinter as tk
from tkinter import messagebox
from urllib.parse import urlsplit, urlunsplit, quote, unquote

CONFIG = Path(__file__).resolve().parents[3] / "operating-postgres.private.json"
root = tk.Tk()
root.title("롤모델챗봇 — 운영 DB 새 비밀번호 저장")
root.geometry("660x350")
root.report_callback_exception = lambda *_: messagebox.showerror("저장 실패", "설정을 갱신하지 못했습니다. 값은 기록하지 않습니다.")
tk.Label(root, justify="left", wraplength=610, text="Supabase에서 방금 변경한 운영 프로젝트의 DB 비밀번호를 두 칸에 입력하세요.\n백업 암호화 키나 Supabase 로그인 비밀번호가 아닙니다.\n기존 로컬 비공개 설정 파일의 비밀번호만 갱신합니다.\nDB 접속·이관·운영 설정 변경·배포는 하지 않습니다.").pack(anchor="w", padx=20, pady=20)
entries = []
for label in ("새 운영 DB 비밀번호", "같은 비밀번호 다시 입력"):
    tk.Label(root, text=label).pack(anchor="w", padx=20)
    entry = tk.Entry(root, show="●", width=72)
    entry.pack(anchor="w", padx=20, pady=6)
    entries.append(entry)


def save():
    first, second = (entry.get() for entry in entries)
    if not first or first != second:
        messagebox.showerror("입력 확인", "두 입력이 일치해야 합니다.")
        return
    try:
        # No second plaintext copy, temporary credential file, command argument or network call.
        with CONFIG.open("r+", encoding="utf-8-sig") as handle:
            config = json.load(handle)
            # Python treats brackets anywhere in netloc as an IPv6 delimiter.
            # Supabase's literal password placeholder is not an IPv6 host.
            url = urlsplit(config["databaseUrl"].replace("[YOUR-PASSWORD]", "YOUR-PASSWORD"))
            if config.get("projectRef") != "rxzholiocjaczueobhsr" or unquote(url.username or "") != "postgres.rxzholiocjaczueobhsr" or url.hostname != "aws-0-ap-northeast-2.pooler.supabase.com" or url.port != 6543:
                raise RuntimeError("WRONG_PROJECT")
            # Keep any password out of the URI; existing Node code encodes the separate value in RAM.
            config["databaseUrl"] = urlunsplit((url.scheme, quote(unquote(url.username), safe=".") + ":[YOUR-PASSWORD]@" + url.hostname + ":6543", url.path, url.query, url.fragment))
            config["databasePassword"] = first
            encoded = json.dumps(config, ensure_ascii=False, indent=2)
            handle.seek(0)
            handle.write(encoded)
            handle.truncate()
            handle.flush()
            os.fsync(handle.fileno())
            config["databasePassword"] = ""
            encoded = ""
        for entry in entries:
            entry.delete(0, "end")
        first = second = ""
        button.config(state="disabled")
        messagebox.showinfo("저장 완료", "기존 비공개 파일에 저장했습니다.\n창을 닫고 ‘새 운영 DB 비밀번호 저장 완료’라고만 알려 주세요.")
    except Exception:
        messagebox.showerror("저장 실패", "비공개 파일을 갱신하지 못했습니다. 값은 기록하지 않습니다.\n실패했다고만 알려 주세요.")


button = tk.Button(root, text="기존 비공개 파일에 저장", command=save)
button.pack(anchor="w", padx=20, pady=12)
root.mainloop()
