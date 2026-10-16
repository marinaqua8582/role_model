"""Local key entry for read-only migration planning; no network and no DB writes."""
import importlib.machinery
import json
import subprocess
import threading
from pathlib import Path
import tkinter as tk

HERE = Path(__file__).resolve().parent
gui = importlib.machinery.SourceFileLoader("backup_gui", str(HERE / "backup_gui.pyw")).load_module()


class PlanApp(gui.BackupApp):
    def show_capture(self):
        self.reset_body()
        self.busy = True
        self.info.config(text="기존 암호화 백업의 읽기 전용 이관 계획을 확인합니다.\n"
                         "원본 데이터와 DB는 변경하지 않습니다. 잠시 기다려 주세요.")
        def run():
            error_kind = "UNVERIFIED"
            try:
                status = json.loads(gui.STATUS.read_text(encoding="utf-8"))
                if status.get("success") is not True or not status.get("decryptionVerified") or not status.get("sourceCompared"):
                    raise RuntimeError("NO_VERIFIED_BACKUP")
                backup = Path(status["backupPath"]).resolve()
                if backup.parent != gui.FOLDER.resolve():
                    raise RuntimeError("FOLDER")
                key_hex = self.key.hex()
                data = json.dumps({"operation": "plan", "backupPath": str(backup), "folder": str(gui.FOLDER),
                                   "keyHex": key_hex, "confirmHex": key_hex}).encode()
                done = subprocess.run([str(gui.NODE), str(HERE / "crypto-worker.mjs")], input=data,
                                      stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                      creationflags=subprocess.CREATE_NO_WINDOW, timeout=180)
                data = b""
                key_hex = ""
                result = json.loads(done.stdout)
                if done.returncode or result.get("success") is not True:
                    error_kind = result.get("errorKind", "UNVERIFIED")
                    raise RuntimeError("PLAN_REFUSED")
                (gui.STATUS.parent / "operating-plan-status.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
                self.root.after(0, lambda: self.finished(result))
            except Exception:
                (gui.STATUS.parent / "operating-plan-status.json").write_text(json.dumps({"success": False, "phase": "read-only-migration-plan", "errorKind": error_kind, "databaseModified": False, "sourceModified": False}), encoding="utf-8")
                self.root.after(0, lambda: self.plan_failed(error_kind))
        threading.Thread(target=run, daemon=True).start()

    def finished(self, result):
        self.busy = False
        self.erase()
        self.info.config(text="읽기 전용 이관 계획 검증 성공\n\n"
                         f"이관 대상 학생: {result['migration']['students']}명\n"
                         "두 테스트 기록은 원본에 보존하고 이관 대상에서만 제외했습니다.\n"
                         "계획은 기존 백업 폴더에 암호화된 형태로만 저장했습니다.\n"
                         "DB 이관·GAS 차단·운영 배포는 실행하지 않았습니다.\n\n"
                         "창을 닫고 ‘이관 계획 검증 성공’이라고 알려 주세요.")

    def plan_failed(self, error_kind):
        self.busy = False
        self.erase()
        self.info.config(text="이관 계획 검증 실패 — 운영 전환 중단\n\n"
                         "키 또는 원본 구조·신원·JSON·자료 충돌을 확인해야 합니다.\n"
                         "원본과 DB는 변경하지 않았습니다.\n"
                         f"확인 코드: {error_kind}\n"
                         "창을 닫고 실패했다고만 알려 주세요. 자료나 키를 채팅에 보내지 마세요.")


root = tk.Tk()
PlanApp(root)
root.title("롤모델챗봇 — 비공개 이관 계획 확인")
root.mainloop()
