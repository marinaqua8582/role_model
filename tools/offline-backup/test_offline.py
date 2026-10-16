import base64
import copy
import csv
import html
import io
import json
import struct
import subprocess
import tempfile
import unittest
from pathlib import Path

from capture_core import SHEETS, REQUIRED, CaptureRefused, make_capture, compare_capture, build_payload, chromium_custom_map

HERE = Path(__file__).resolve().parent
NODE = r"C:\Program Files\nodejs\node.exe"


def formats(sheet):
    headers = sorted(REQUIRED[sheet]) + ["extra"]
    grid = [headers, ["synthetic-only"] * (len(headers) - 1) + ['{"line":"a\\nb"}\n끝'], [""] * len(headers)]
    text = io.StringIO(newline="")
    csv.writer(text, delimiter="\t", lineterminator="\r\n").writerows(grid)
    table = '<table>' + ''.join('<tr>' + ''.join('<td data-sheets-value="{&quot;1&quot;:2}" data-sheets-formula="=1+1">' + html.escape(cell).replace('\n', '<br>') + '</td>' for cell in row) + '</tr>' for row in grid) + '</table>'
    return {"UnicodeText": (text.getvalue() + '\0').encode('utf-16-le'), "HTML Format": table.encode()}


class OfflineBackupTests(unittest.TestCase):
    def payload(self):
        first = {s: make_capture(s, formats(s)) for s in SHEETS}
        return build_payload(first, copy.deepcopy(first), True)

    def test_multiline_json_blank_and_formula(self):
        item = make_capture('Roster', formats('Roster'))
        self.assertEqual(item['counts']['dataRows'], 1)
        self.assertEqual(item['counts']['selectedRows'], 3)
        self.assertIn('\n끝', item['projection']['grid'][1][-1])
        self.assertEqual(item['projection']['richCells'][0][0]['metadata']['data-sheets-formula'], '=1+1')
        self.assertEqual(base64.b64decode(item['rawFormats']['HTML Format']), formats('Roster')['HTML Format'])

    def test_wrong_sheet_refused(self):
        with self.assertRaises(CaptureRefused):
            make_capture('Tests', formats('Roster'))

    def test_plaintext_only_refused(self):
        f = formats('Roster'); del f['HTML Format']
        with self.assertRaises(CaptureRefused): make_capture('Roster', f)

    def test_merged_cells_refused(self):
        f = formats('Roster'); f['HTML Format'] = f['HTML Format'].replace(b'<td ', b'<td colspan="2" ', 1)
        with self.assertRaises(CaptureRefused): make_capture('Roster', f)

    def test_rich_mismatch_refused(self):
        f = formats('Roster'); f['HTML Format'] = f['HTML Format'].replace(b'synthetic-only', b'changed', 1)
        with self.assertRaises(CaptureRefused): make_capture('Roster', f)

    def test_changed_source_refused(self):
        a = make_capture('Tests', formats('Tests')); b = copy.deepcopy(a)
        b['projection']['grid'][1][0] = 'changed'
        with self.assertRaises(CaptureRefused): compare_capture(a, b)

    def test_missing_sheet_or_confirmation_refused(self):
        p = self.payload()
        with self.assertRaises(CaptureRefused): build_payload(p['first'], p['second'], False)
        del p['second']['Tests']
        with self.assertRaises(CaptureRefused): build_payload(p['first'], p['second'], True)

    def test_chromium_native_map(self):
        def string(s):
            value = s.encode('utf-16-le')
            return struct.pack('<i', len(value)//2) + value + bytes((-len(value)) % 4)
        body = struct.pack('<I', 1) + string('mime') + string('값')
        self.assertEqual(chromium_custom_map(struct.pack('<I', len(body)) + body), {'mime': '값'})

    def test_encrypt_disk_readback_tag_key_and_no_plaintext(self):
        with tempfile.TemporaryDirectory() as folder:
            request = {'operation': 'seal', 'folder': str(Path(folder).resolve()), 'payload': self.payload(), 'keyHex': 'ab'*32, 'confirmHex': 'ab'*32}
            result = subprocess.run([NODE, str(HERE/'crypto-worker.mjs')], input=json.dumps(request).encode(), capture_output=True)
            self.assertEqual(result.returncode, 0, result.stdout.decode())
            status = json.loads(result.stdout)
            self.assertTrue(status['decryptionVerified'])
            self.assertTrue(status['tagTamperingRejected'])
            self.assertTrue(status['wrongKeyRejected'])
            files = list(Path(folder).iterdir())
            self.assertEqual(len(files), 1)
            self.assertTrue(files[0].name.endswith('.verified.enc'))
            self.assertNotIn(b'synthetic-only', files[0].read_bytes())
            request = {'operation': 'verify', 'backupPath': str(files[0]), 'keyHex': 'cd'*32, 'confirmHex': 'cd'*32}
            bad = subprocess.run([NODE, str(HERE/'crypto-worker.mjs')], input=json.dumps(request).encode(), capture_output=True)
            self.assertNotEqual(bad.returncode, 0)
            self.assertNotIn(b'synthetic-only', bad.stdout + bad.stderr)
            self.assertNotIn(b'cdcdcdcd', bad.stdout + bad.stderr)

    def test_mismatched_key_creates_no_file(self):
        with tempfile.TemporaryDirectory() as folder:
            request = {'operation': 'seal', 'folder': folder, 'payload': self.payload(), 'keyHex': 'ab'*32, 'confirmHex': 'cd'*32}
            result = subprocess.run([NODE, str(HERE/'crypto-worker.mjs')], input=json.dumps(request).encode(), capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(list(Path(folder).iterdir()), [])


if __name__ == '__main__':
    unittest.main()
