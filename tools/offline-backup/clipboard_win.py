"""Read Google Sheets clipboard formats into RAM. Never writes plaintext files."""
import ctypes as c
from ctypes import wintypes as w

MAX_BYTES = 64 * 1024 * 1024
ALLOWED = {"HTML Format", "text/html", "Chromium Web Custom MIME Data Format",
           "application/x-vnd.google-spreadsheet-compact-table+json"}


def read_formats():
    u, k = c.WinDLL("user32", use_last_error=True), c.WinDLL("kernel32", use_last_error=True)
    u.OpenClipboard.argtypes = [w.HWND]
    u.GetClipboardData.argtypes = [w.UINT]
    u.GetClipboardData.restype = w.HANDLE
    u.EnumClipboardFormats.argtypes = [w.UINT]
    u.EnumClipboardFormats.restype = w.UINT
    u.GetClipboardFormatNameW.argtypes = [w.UINT, w.LPWSTR, c.c_int]
    k.GlobalSize.argtypes = [w.HANDLE]
    k.GlobalSize.restype = c.c_size_t
    k.GlobalLock.argtypes = [w.HANDLE]
    k.GlobalLock.restype = c.c_void_p
    k.GlobalUnlock.argtypes = [w.HANDLE]
    if not u.OpenClipboard(None):
        raise RuntimeError("CLIPBOARD_BUSY")
    result = {}
    try:
        fmt = 0
        while True:
            fmt = u.EnumClipboardFormats(fmt)
            if not fmt:
                break
            name = c.create_unicode_buffer(256)
            u.GetClipboardFormatNameW(fmt, name, 256)
            kind = "UnicodeText" if fmt == 13 else name.value
            if kind != "UnicodeText" and kind not in ALLOWED:
                continue
            handle = u.GetClipboardData(fmt)
            size = k.GlobalSize(handle)
            if not size or size > MAX_BYTES:
                raise RuntimeError("CLIPBOARD_SIZE")
            pointer = k.GlobalLock(handle)
            if not pointer:
                raise RuntimeError("CLIPBOARD_READ")
            try:
                result[kind] = c.string_at(pointer, size)
            finally:
                k.GlobalUnlock(handle)
        return result
    finally:
        u.CloseClipboard()


def clear_clipboard():
    u = c.WinDLL("user32", use_last_error=True)
    if u.OpenClipboard(None):
        try:
            u.EmptyClipboard()
        finally:
            u.CloseClipboard()
