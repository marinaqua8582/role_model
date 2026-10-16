"""Teacher-operated final source backup and approved operating PostgreSQL import."""
import importlib.machinery
import json
import subprocess
import threading
import time
from pathlib import Path
import tkinter as tk

HERE = Path(__file__).resolve().parent
gui = importlib.machinery.SourceFileLoader("backup_gui", str(HERE / "backup_gui.pyw")).load_module()


class CutoverApp(gui.BackupApp):
    def show_capture(self):
        super().show_capture()
        self.info.config(text=self.info.cget("text").replace(
            "이 도구는 네트워크에 연결하지 않으며 복사된 원본을 메모리에만 보관합니다.",
            "현재 수집 단계는 원본을 메모리에만 보관합니다. 최종 버튼을 누르면 승인된 운영 DB로만 이관합니다."))

    def accept_key(self):
        try:
            freeze = json.loads((gui.STATUS.parent / "operating-freeze-state.private.json").read_text(encoding="utf-8"))
            if not freeze.get("closed") or not freeze.get("oldExecutionsDrained") or int(time.time() * 1000) < freeze["drainCompleteAt"]:
                raise RuntimeError("NOT_FROZEN")
        except Exception:
            gui.messagebox.showerror("전환 준비", "운영 GAS 차단·기존 요청 종료 확인이 없습니다. 원본을 수집하거나 DB에 이관하지 않습니다.")
            return
        self.capture_started = int(time.time() * 1000)
        super().accept_key()

    def show_confirm(self):
        super().show_confirm()
        self.seal_button.config(text="최종 암호화 백업·검증 후 승인된 운영 DB 이관")
        self.info.config(text=self.info.cget("text") + "\n\n백업·이관 계획 검증이 성공하면 지정 운영 PostgreSQL로만 이관합니다.\n학생별 자료 대조 후에도 DB 쓰기는 차단 상태로 유지합니다. 운영 앱 배포는 별도 단계입니다.")

    def seal(self):
        if not self.confirm.get():
            return
        self.busy = True
        self.seal_button.config(state="disabled")
        self.info.config(text="최종 원본 백업·복호화 대조·운영 PostgreSQL 이관을 진행합니다.\n창을 닫지 마세요. 키와 원본은 로그·평문 파일에 기록하지 않습니다.\n대상: role-model-operating-seoul-20261015 (합성 DB 아님)\n이관 후에도 새 DB 쓰기는 차단 상태로 유지합니다.")
        source = gui.build_payload(self.first, self.second, True)
        def run():
            try:
                key_hex = self.key.hex()
                data = json.dumps({"operation": "APPROVED_OPERATING_IMPORT", "folder": str(gui.FOLDER), "payload": source,
                                   "captureStartedAt": self.capture_started, "keyHex": key_hex, "confirmHex": key_hex}, ensure_ascii=False).encode("utf-8")
                done = subprocess.run([str(gui.NODE), str(HERE / "cutover-import-worker.mjs")], input=data,
                                      stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                      creationflags=subprocess.CREATE_NO_WINDOW, timeout=900)
                data = b""
                key_hex = ""
                result = json.loads(done.stdout)
                (gui.STATUS.parent / "operating-import-status.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
                if done.returncode or result.get("success") is not True:
                    raise RuntimeError("STOPPED")
                gui.STATUS.write_text(json.dumps(result["backup"], ensure_ascii=False, indent=2), encoding="utf-8")
                self.root.after(0, lambda: self.finished(result))
            except Exception:
                self.root.after(0, self.import_failed)
        threading.Thread(target=run, daemon=True).start()

    def finished(self, result):
        self.busy = False
        self.erase()
        self.reset_body()
        self.info.config(text="최종 백업 및 운영 DB 이관·대조 성공\n\n"
                         f"학생 {result['students']}명 / 답안·버전 일치 / receipt {result['receipts']}개 보존\n"
                         "원본 Google Sheets는 수정하지 않았습니다.\n"
                         "운영 GAS와 새 DB 쓰기는 차단 상태이며 production 배포 전입니다.\n\n"
                         "창을 닫고 ‘최종 백업·이관 대조 성공’이라고 알려 주세요.")

    def import_failed(self):
        self.busy = False
        self.erase()
        self.reset_body()
        self.info.config(text="작업 중단 — 운영 전환 성공으로 처리하지 않습니다.\n"
                         "원본과 암호화 백업은 보존합니다. DB 상태를 확인하기 전 배포하거나 저장을 개방하지 않습니다.\n"
                         "실패했다고만 알려 주세요. 키나 자료는 채팅에 보내지 마세요.")


root = tk.Tk()
CutoverApp(root)
root.title("롤모델챗봇 — 쓰기 차단 후 최종 백업·승인 이관")
root.mainloop()
