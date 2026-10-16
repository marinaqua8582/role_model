"""Memory-only Google Sheets clipboard validation. No network, file writes, or logging."""
import base64
import csv
import io
import json
import struct
from html.parser import HTMLParser

SHEETS = ("Roster", "Progress", "Tests", "Submissions")
REQUIRED = {
    "Roster": {"grade", "class", "number", "name", "googleId"},
    "Progress": {"studentKey", "currentStep", "stepData"},
    "Tests": {"studentKey", "test1Result", "step8Data"},
    "Submissions": {"submittedAt", "grade", "class", "number", "name"},
}
COMPACT = "application/x-vnd.google-spreadsheet-compact-table+json"


class CaptureRefused(Exception):
    pass


def chromium_custom_map(raw):
    """Chromium custom_data_helper.cc: Pickle header, UInt32 count, String16 pairs."""
    if len(raw) < 8:
        raise CaptureRefused("CUSTOM_FORMAT")
    size, count = struct.unpack_from("<II", raw)
    limit = 4 + size
    if limit > len(raw) or count > 64:
        raise CaptureRefused("CUSTOM_FORMAT")
    pos = 8

    def string16():
        nonlocal pos
        if pos + 4 > limit:
            raise CaptureRefused("CUSTOM_FORMAT")
        n = struct.unpack_from("<i", raw, pos)[0]
        pos += 4
        if n < 0 or n > 32_000_000 or pos + n * 2 > limit:
            raise CaptureRefused("CUSTOM_FORMAT")
        try:
            value = raw[pos:pos + n * 2].decode("utf-16-le")
        except UnicodeError:
            raise CaptureRefused("CUSTOM_FORMAT") from None
        pos += (n * 2 + 3) & ~3
        return value

    result = {}
    for _ in range(count):
        kind, value = string16(), string16()
        result[kind] = value
    return result


def html_fragment(raw):
    # CF_HTML offsets are byte offsets, not character offsets. Retain raw bytes separately.
    values = {}
    for line in raw[:1024].splitlines():
        if b":" in line:
            k, v = line.split(b":", 1)
            if k in (b"StartHTML", b"EndHTML"):
                try:
                    values[k] = int(v.strip())
                except ValueError:
                    pass
    start, end = values.get(b"StartHTML", -1), values.get(b"EndHTML", -1)
    if 0 <= start < end <= len(raw):
        raw = raw[start:end]
    return raw.rstrip(b"\0").decode("utf-8", errors="strict")


class CellParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.row = None
        self.cell = None
        self.table_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "table":
            self.table_depth += 1
        if self.table_depth != 1:
            return
        if tag == "tr":
            if self.row is not None:
                raise CaptureRefused("HTML_GRID")
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            if self.cell is not None:
                raise CaptureRefused("HTML_GRID")
            # Merged cells require a separate verified reconstruction, never silently flatten.
            if attrs.get("rowspan", "1") != "1" or attrs.get("colspan", "1") != "1":
                raise CaptureRefused("MERGED_CELLS")
            metadata = {k: v for k, v in attrs.items() if k.startswith("data-sheets-")}
            for key in ("data-sheets-value", "data-sheets-numberformat"):
                if key in metadata:
                    try:
                        json.loads(metadata[key])
                    except (ValueError, TypeError):
                        raise CaptureRefused("CELL_METADATA") from None
            self.cell = {"text": "", "metadata": metadata}
        elif tag == "br" and self.cell is not None:
            self.cell["text"] += "\n"

    def handle_endtag(self, tag):
        if self.table_depth == 1:
            if tag in ("td", "th") and self.cell is not None:
                self.row.append(self.cell)
                self.cell = None
            elif tag == "tr" and self.row is not None:
                self.rows.append(self.row)
                self.row = None
        if tag == "table":
            self.table_depth -= 1

    def handle_data(self, text):
        if self.table_depth == 1 and self.cell is not None:
            self.cell["text"] += text


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def make_capture(sheet, formats):
    if sheet not in SHEETS or "UnicodeText" not in formats:
        raise CaptureRefused("SOURCE_FORMAT")
    try:
        text = formats["UnicodeText"].decode("utf-16-le").split("\0", 1)[0]
        grid = list(csv.reader(io.StringIO(text, newline=""), delimiter="\t"))
    except (UnicodeError, csv.Error):
        raise CaptureRefused("TEXT_GRID") from None
    if not grid or not REQUIRED[sheet].issubset(set(grid[0])):
        raise CaptureRefused("WRONG_SHEET_OR_RANGE")
    width = len(grid[0])
    if any(len(row) != width for row in grid):
        raise CaptureRefused("INCOMPLETE_GRID")
    raw_html = formats.get("HTML Format", formats.get("text/html"))
    if raw_html is None:
        raise CaptureRefused("RICH_FORMAT_MISSING")
    parser = CellParser()
    try:
        parser.feed(html_fragment(raw_html))
        parser.close()
    except (UnicodeError, ValueError):
        raise CaptureRefused("HTML_GRID") from None
    if len(parser.rows) != len(grid) or any(len(r) != width for r in parser.rows):
        raise CaptureRefused("INCOMPLETE_RICH_GRID")
    # Displayed text is backed by the independently copied native rich cell data.
    if any(c["text"].replace("\r\n", "\n").replace("\xa0", " ") != value.replace("\r\n", "\n").replace("\xa0", " ")
           for row, rich in zip(grid, parser.rows) for value, c in zip(row, rich)):
        raise CaptureRefused("TEXT_RICH_MISMATCH")
    compact = None
    if "Chromium Web Custom MIME Data Format" in formats:
        custom = chromium_custom_map(formats["Chromium Web Custom MIME Data Format"])
        if COMPACT in custom:
            compact = json.loads(custom[COMPACT])
    if COMPACT in formats:
        compact = json.loads(formats[COMPACT].rstrip(b"\0").decode("utf-8"))
    typed = any("data-sheets-value" in cell["metadata"] for row in parser.rows for cell in row)
    if compact is None and not typed:
        raise CaptureRefused("TYPED_METADATA_MISSING")
    projection = {"grid": grid, "richCells": parser.rows, "compact": compact}
    return {
        "sheet": sheet,
        "projection": projection,
        "rawFormats": {kind: base64.b64encode(value).decode("ascii") for kind, value in formats.items()},
        "counts": {"selectedRows": len(grid), "selectedColumns": width,
                   "dataRows": sum(any(v != "" for v in row) for row in grid[1:])},
    }


def compare_capture(first, second):
    if first["sheet"] != second["sheet"] or canonical(first["projection"]) != canonical(second["projection"]):
        raise CaptureRefused("SOURCE_CHANGED_OR_RANGE_DIFFERS")
    return True


def build_payload(first, second, full_selection_confirmed):
    if not full_selection_confirmed or set(first) != set(SHEETS) or set(second) != set(SHEETS):
        raise CaptureRefused("INCOMPLETE_WORKBOOK")
    for sheet in SHEETS:
        compare_capture(first[sheet], second[sheet])
    if first["Roster"]["counts"]["dataRows"] < 1:
        raise CaptureRefused("EMPTY_ROSTER")
    return {"format": "role-model-native-sheet-source-v1", "first": first, "second": second,
            "verification": {"allSelectedSourceCellsIncluded": True, "sourceDoubleReadMatched": True,
                             "noTestRowsExcluded": True, "fullSelectionConfirmedByOperator": True},
            "scope": "Source cell clipboard archive; no original writes, no database migration."}
