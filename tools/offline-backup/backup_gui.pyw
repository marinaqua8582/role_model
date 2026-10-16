"""User-operated offline backup. No network; key and original cells stay in RAM."""
import json
import os
import re
import subprocess
import threading
from pathlib import Path
import tkinter as tk
from tkinter import messagebox

from capture_core import SHEETS, CaptureRefused, make_capture, compare_capture, build_payload
from clipboard_win import read_formats, clear_clipboard

HERE = Path(__file__).resolve().parent
FOLDER = Path.home() / "롤모델챗봇_운영백업"
STATUS = HERE.parents[2] / "offline-backup-status.json"
NODE = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "nodejs" / "node.exe"


class BackupApp:
    def __init__(self, root):
        self.root, self.key, self.index = root, None, 0
        self.busy = False
        root.report_callback_exception = lambda *_: messagebox.showerror("실행 중단", "예상하지 못한 오류입니다. 개인정보 보호를 위해 상세 오류를 기록하지 않습니다.")
        self.first, self.second = {}, {}
        root.title("롤모델챗봇 — 오프라인 암호화 백업")
        root.geometry("760x640")
        root.protocol("WM_DELETE_WINDOW", self.close)
        self.info = tk.Label(root, justify="left", anchor="w", wraplength=710, font=("맑은 고딕", 11))
        self.info.pack(fill="x", padx=20, pady=20)
        self.body = tk.Frame(root)
        self.body.pack(fill="both", expand=True, padx=20)
        self.info.config(text="1단계: KeePassXC에 저장한 기존 백업 키를 두 칸에 입력하세요.\n64자리 16진수 키이며 화면에 표시하지 않습니다.\n키는 로컬 메모리에서만 사용하고 파일·명령줄·로그에 기록하지 않습니다.\n입력 후 ‘키 확인’을 누르세요. 브라우저 키 입력 페이지는 사용하지 않습니다.")
        self.entries = []
        for label in ("백업 키", "같은 키 다시 입력"):
            tk.Label(self.body, text=label).pack(anchor="w")
            entry = tk.Entry(self.body, show="●", width=70)
            entry.pack(anchor="w", pady=8)
            self.entries.append(entry)
        tk.Button(self.body, text="키 확인", command=self.accept_key).pack(anchor="w", pady=15)

    def reset_body(self):
        for child in self.body.winfo_children():
            child.destroy()

    def accept_key(self):
        a, b = (e.get().strip() for e in self.entries)
        if not re.fullmatch(r"[0-9a-fA-F]{64}", a) or a.lower() != b.lower():
            messagebox.showerror("키 확인", "64자리 16진수 키 두 개가 일치해야 합니다.")
            return
        if not FOLDER.is_dir() or FOLDER.is_symlink() or not NODE.is_file():
            messagebox.showerror("준비 확인", "지정 백업 폴더 또는 기존 Node 실행 파일을 확인하지 못했습니다. 실행을 중단합니다.")
            return
        self.key = bytearray.fromhex(a)
        for entry in self.entries:
            entry.delete(0, "end")
        a = b = ""
        clear_clipboard()
        self.entries.clear()
        self.show_capture()

    def show_capture(self):
        self.reset_body()
        pass_no, sheet_no = divmod(self.index, len(SHEETS))
        sheet = SHEETS[sheet_no]
        self.info.config(text=f"{self.index + 2}단계: 원본 {sheet} 시트 전체 복사 ({pass_no + 1}/2차 대조)\n\n"
                         f"기존 운영 Google Sheets의 ‘{sheet}’ 탭을 직접 선택하세요.\n"
                         "셀 A1을 클릭 → Ctrl+End → Ctrl+Shift+Home → Ctrl+C\n"
                         "이 창으로 돌아와 아래 ‘현재 시트 수집’을 누르세요.\n"
                         "값을 붙여넣거나 수정하지 마세요. 테스트 기록도 제외하지 않습니다.\n"
                         "네 개 시트를 두 번 읽어 모든 선택 셀·행 순서·형식 메타데이터를 대조합니다.\n"
                         "이 도구는 네트워크에 연결하지 않으며 복사된 원본을 메모리에만 보관합니다.")
        tk.Button(self.body, text=f"현재 시트 수집: {sheet}", command=self.capture).pack(anchor="w", pady=15)
        tk.Label(self.body, text="필터·숨김 행/열 또는 추가 시트가 있다면 먼저 중단하세요.\n"
                 "이 도구는 네 표의 선택된 셀 원본을 보존합니다. 파일 이력·권한·댓글 백업은 아닙니다.", justify="left").pack(anchor="w")

    def capture(self):
        sheet = SHEETS[self.index % len(SHEETS)]
        try:
            captured = make_capture(sheet, read_formats())
            if self.index >= len(SHEETS):
                compare_capture(self.first[sheet], captured)
                self.second[sheet] = captured
            else:
                self.first[sheet] = captured
            clear_clipboard()
        except CaptureRefused as error:
            messagebox.showerror("수집 중단", f"원본 전체 범위/클립보드 형식을 확인할 수 없습니다. 코드: {error}\n"
                                 "값은 저장하지 않았습니다. 원본은 수정하지 말고 담당자에게 코드만 알려 주세요.")
            return
        except Exception:
            messagebox.showerror("수집 중단", "수집에 실패했습니다. 개인정보가 포함될 수 있는 오류 상세는 기록하지 않습니다.")
            return
        self.index += 1
        if self.index < 2 * len(SHEETS):
            self.show_capture()
        else:
            self.show_confirm()

    def show_confirm(self):
        self.reset_body()
        counts = "\n".join(f"{s}: 데이터 {self.first[s]['counts']['dataRows']}행 / 선택 {self.first[s]['counts']['selectedColumns']}열" for s in SHEETS)
        self.info.config(text="원본 2회 대조 일치. 아직 백업 파일은 생성하지 않았습니다.\n\n" + counts +
                         f"\n\n암호화 파일 저장 위치: {FOLDER}\n"
                         "원본이 네 표뿐이고 필터/숨김 없이 모든 행·열을 복사했는지 확인하세요.\n"
                         "대조 중 원본 저장이 발생했다면 종료 후 수업 외 시간에 다시 수집하세요.")
        self.confirm = tk.BooleanVar(value=False)
        tk.Checkbutton(self.body, text="네 표의 원본 전체 범위와 두 테스트 기록을 빠짐없이 포함했습니다.", variable=self.confirm).pack(anchor="w")
        self.seal_button = tk.Button(self.body, text="암호화 저장 및 복호화·무결성 검증", command=self.seal)
        self.seal_button.pack(anchor="w", pady=20)

    def seal(self):
        if not self.confirm.get():
            return
        self.seal_button.config(state="disabled")
        self.busy = True
        self.info.config(text="암호화 및 저장 파일 복호화 대조 중입니다. 창을 닫지 마세요.\n"
                         "키·원본은 비공개 프로세스 입력 파이프로만 전달합니다.")
        payload = build_payload(self.first, self.second, True)
        def worker():
            try:
                key_hex = self.key.hex()
                request = json.dumps({"operation": "seal", "folder": str(FOLDER), "payload": payload,
                                      "keyHex": key_hex, "confirmHex": key_hex}, ensure_ascii=False).encode("utf-8")
                result = subprocess.run([str(NODE), str(HERE / "crypto-worker.mjs")], input=request,
                                        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                        creationflags=subprocess.CREATE_NO_WINDOW, timeout=180)
                request = b""
                key_hex = ""
                status = json.loads(result.stdout)
                if result.returncode or status.get("success") is not True:
                    raise RuntimeError("BACKUP_FAILED")
                STATUS.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
                self.root.after(0, lambda: self.finish(status))
            except Exception:
                self.root.after(0, self.failed)
        threading.Thread(target=worker, daemon=True).start()

    def finish(self, status):
        self.busy = False
        self.erase()
        self.reset_body()
        self.info.config(text="백업 검증 성공\n\n"
                         "저장 파일을 다시 읽어 복호화·인증 태그·전체 원본 대조를 통과했습니다.\n"
                         "잘못된 키와 손상된 태그의 복호화 거절도 확인했습니다.\n"
                         "원본 시트와 GAS는 변경하지 않았습니다.\n\n" + status["backupPath"] +
                         "\n\n이 창을 닫고 ‘오프라인 백업 검증 성공’이라고 알려 주세요.\n"
                         "이는 셀 원본 백업 검증이며 원본 시트에 복원하거나 DB로 이관하지 않았습니다.")

    def failed(self):
        self.busy = False
        self.erase()
        self.reset_body()
        self.info.config(text="백업 실패 — 성공으로 처리하지 않습니다.\n"
                         "암호화된 pending 파일이 남아 있을 수 있습니다. 평문 원본은 파일로 기록하지 않았습니다.\n"
                         "원본은 변경하지 않았습니다. 창을 닫고 실패했다고만 알려 주세요.")

    def erase(self):
        if self.key is not None:
            self.key[:] = bytes(len(self.key))
            self.key = None
        self.first.clear()
        self.second.clear()
        clear_clipboard()

    def close(self):
        if self.busy:
            messagebox.showinfo("검증 중", "암호화 파일 검증이 끝날 때까지 기다려 주세요.")
            return
        self.erase()
        self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    BackupApp(root)
    root.mainloop()
