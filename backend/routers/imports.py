"""
Renim AI — Import notes from other tools (file based, no OAuth).

Supported uploads:
  .md / .markdown / .txt   plain Markdown or text
  .html / .htm             Google Docs "Download as HTML", Notion HTML export
  .zip                     Notion export (Markdown or HTML pages)
  .enex                    Evernote export
All HTML is reduced to a small allow-list of tags before it is stored.
"""

import html
import io
import posixpath
import re
import zipfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Optional, List, Dict, Any, Tuple

from fastapi import APIRouter, Header, UploadFile, File
from fastapi.responses import JSONResponse

from db import get_db_pool, is_user_active, resolve_org_access, log_audit
from auth_utils import resolve_authenticated_email, server_error

try:  # Hardened XML parsing when available.
    from defusedxml import ElementTree as SafeET  # type: ignore
    _HAS_DEFUSED = True
except Exception:  # pragma: no cover - fallback path
    import xml.etree.ElementTree as SafeET  # type: ignore
    _HAS_DEFUSED = False

router = APIRouter(prefix="/api/import", tags=["Import"])

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_ZIP_ENTRY_BYTES = 2 * 1024 * 1024
MAX_ZIP_ENTRIES = 500
MAX_ZIP_TOTAL_BYTES = 50 * 1024 * 1024
MAX_NOTES_PER_IMPORT = 500
MAX_NOTE_CHARS = 500_000

TEXT_EXTS = (".md", ".markdown", ".txt")
HTML_EXTS = (".html", ".htm")


# ---------------------------------------------------------------------------
# HTML sanitizer (allow-list)
# ---------------------------------------------------------------------------

ALLOWED_TAGS = {
    "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "strong", "b", "em", "i", "u", "s",
    "del", "code", "pre", "blockquote", "a", "table", "thead", "tbody", "tr", "th", "td", "div", "span",
}
DROP_CONTENT_TAGS = {"script", "style", "head", "title", "iframe", "object", "embed", "noscript", "template", "svg", "math"}
VOID_TAGS = {"br", "hr"}
TAG_ALIASES = {"en-note": "div"}


class _Sanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: List[str] = []
        self.skip_depth = 0
        self.open_tags: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        tag = TAG_ALIASES.get(tag.lower(), tag.lower())
        if tag in DROP_CONTENT_TAGS:
            self.skip_depth += 1
            return
        if self.skip_depth:
            return
        if tag == "en-todo":
            checked = any(k == "checked" and (v or "").lower() == "true" for k, v in attrs)
            self.out.append("[x] " if checked else "[ ] ")
            return
        if tag not in ALLOWED_TAGS:
            return
        attr_txt = ""
        if tag == "a":
            href = next((v for k, v in attrs if k.lower() == "href" and v), "")
            href = (href or "").strip()
            if re.match(r"^(https?:|mailto:)", href, re.I):
                attr_txt = f' href="{html.escape(href, quote=True)}" target="_blank" rel="noopener noreferrer"'
        self.out.append(f"<{tag}{attr_txt}>")
        if tag not in VOID_TAGS:
            self.open_tags.append(tag)

    def handle_startendtag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        tag_l = TAG_ALIASES.get(tag.lower(), tag.lower())
        if tag_l in VOID_TAGS and not self.skip_depth:
            self.out.append(f"<{tag_l}>")
        elif tag_l == "en-todo":
            self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        tag = TAG_ALIASES.get(tag.lower(), tag.lower())
        if tag in DROP_CONTENT_TAGS:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if self.skip_depth or tag not in ALLOWED_TAGS or tag in VOID_TAGS:
            return
        if tag in self.open_tags:
            while self.open_tags:
                t = self.open_tags.pop()
                self.out.append(f"</{t}>")
                if t == tag:
                    break

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            self.out.append(html.escape(data, quote=False))

    def result(self) -> str:
        while self.open_tags:
            self.out.append(f"</{self.open_tags.pop()}>")
        return "".join(self.out)


def sanitize_html(raw: str) -> str:
    parser = _Sanitizer()
    try:
        parser.feed(raw or "")
        parser.close()
    except Exception:
        return f"<p>{html.escape(re.sub(r'<[^>]+>', ' ', raw or ''))}</p>"
    out = parser.result()
    out = re.sub(r"(<(div|span|p)>\s*</\2>)+", "", out)
    return out.strip()


def _html_body_and_title(raw: str) -> Tuple[str, str]:
    title = ""
    m = re.search(r"<title[^>]*>(.*?)</title>", raw, re.I | re.S)
    if m:
        title = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
    body = raw
    b = re.search(r"<body[^>]*>(.*)</body>", raw, re.I | re.S)
    if b:
        body = b.group(1)
    if not title:
        h = re.search(r"<h1[^>]*>(.*?)</h1>", body, re.I | re.S)
        if h:
            title = html.unescape(re.sub(r"<[^>]+>", "", h.group(1))).strip()
    return sanitize_html(body), title


# ---------------------------------------------------------------------------
# Markdown -> simple HTML (input is escaped first, so output is always safe)
# ---------------------------------------------------------------------------

def _md_inline(text: str) -> str:
    text = html.escape(text, quote=False)
    codes: List[str] = []

    def _stash(m: "re.Match[str]") -> str:
        codes.append(f"<code>{m.group(1)}</code>")
        return f"\x00{len(codes) - 1}\x00"

    text = re.sub(r"`([^`]+)`", _stash, text)

    def _link(m: "re.Match[str]") -> str:
        label, url = m.group(1), m.group(2).strip()
        if re.match(r"^(https?:|mailto:)", url, re.I):
            return f'<a href="{html.escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{label}</a>'
        return label

    text = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)[^)]*\)", lambda m: m.group(1), text)
    text = re.sub(r"\[([^\]]+)\]\(([^)\s]+)[^)]*\)", _link, text)
    text = re.sub(r"\*\*(.+?)\*\*|__(.+?)__", lambda m: f"<strong>{m.group(1) or m.group(2)}</strong>", text)
    text = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r"<em>\1</em>", text)
    text = re.sub(r"(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])", r"<em>\1</em>", text)
    text = re.sub(r"~~(.+?)~~", r"<s>\1</s>", text)
    text = re.sub(r"\x00(\d+)\x00", lambda m: codes[int(m.group(1))], text)
    return text


def markdown_to_html(md: str) -> str:
    lines = (md or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out: List[str] = []
    para: List[str] = []
    list_type: Optional[str] = None
    in_code = False
    code_buf: List[str] = []

    def flush_para() -> None:
        if para:
            out.append("<p>" + "<br>".join(_md_inline(p) for p in para) + "</p>")
            para.clear()

    def close_list() -> None:
        nonlocal list_type
        if list_type:
            out.append(f"</{list_type}>")
            list_type = None

    for line in lines:
        if line.strip().startswith("```"):
            if in_code:
                out.append("<pre><code>" + html.escape("\n".join(code_buf), quote=False) + "</code></pre>")
                code_buf.clear()
                in_code = False
            else:
                flush_para()
                close_list()
                in_code = True
            continue
        if in_code:
            code_buf.append(line)
            continue
        stripped = line.strip()
        if not stripped:
            flush_para()
            close_list()
            continue
        h = re.match(r"^(#{1,6})\s+(.*)$", stripped)
        if h:
            flush_para()
            close_list()
            lvl = len(h.group(1))
            out.append(f"<h{lvl}>{_md_inline(h.group(2).rstrip('#').strip())}</h{lvl}>")
            continue
        if re.match(r"^(-{3,}|\*{3,}|_{3,})$", stripped):
            flush_para()
            close_list()
            out.append("<hr>")
            continue
        ul = re.match(r"^\s*[-*+]\s+(?:\[( |x|X)\]\s+)?(.*)$", line)
        ol = re.match(r"^\s*\d+[.)]\s+(.*)$", line)
        if ul or ol:
            flush_para()
            want = "ul" if ul else "ol"
            if list_type != want:
                close_list()
                out.append(f"<{want}>")
                list_type = want
            if ul:
                box = ul.group(1)
                prefix = "" if box is None else ("[x] " if box.lower() == "x" else "[ ] ")
                out.append(f"<li>{prefix}{_md_inline(ul.group(2))}</li>")
            else:
                out.append(f"<li>{_md_inline(ol.group(1))}</li>")
            continue
        if stripped.startswith(">"):
            flush_para()
            close_list()
            out.append(f"<blockquote>{_md_inline(stripped.lstrip('>').strip())}</blockquote>")
            continue
        close_list()
        para.append(stripped)

    if in_code:
        out.append("<pre><code>" + html.escape("\n".join(code_buf), quote=False) + "</code></pre>")
    flush_para()
    close_list()
    return "\n".join(out)


def _md_title(md: str, fallback: str) -> Tuple[str, str]:
    """Uses a leading '# Heading' as the title and removes it from the body."""
    lines = md.lstrip("﻿").split("\n")
    for i, line in enumerate(lines):
        if not line.strip():
            continue
        m = re.match(r"^#\s+(.*)$", line.strip())
        if m:
            return m.group(1).strip(), "\n".join(lines[i + 1:])
        break
    return fallback, md


# ---------------------------------------------------------------------------
# Format parsers -> list of {title, content, tags, created_at}
# ---------------------------------------------------------------------------

def _clean_filename_title(name: str) -> str:
    base = posixpath.basename(name.replace("\\", "/"))
    base = re.sub(r"\.(md|markdown|txt|html?|enex)$", "", base, flags=re.I)
    base = re.sub(r"\s+[0-9a-f]{32}$", "", base, flags=re.I)  # Notion appends a page id
    return base.strip() or "Imported Note"


def _decode(data: bytes) -> str:
    for enc in ("utf-8-sig", "utf-16"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("latin-1", errors="replace")


def _parse_text_file(name: str, data: bytes, source: str) -> Dict[str, Any]:
    text = _decode(data)
    title, body = _md_title(text, _clean_filename_title(name))
    if name.lower().endswith(".txt"):
        content = "".join(f"<p>{html.escape(p.strip(), quote=False)}</p>" for p in re.split(r"\n\s*\n", body) if p.strip())
    else:
        content = markdown_to_html(body)
    return {"title": title, "content": content, "tags": ["imported", source]}


def _parse_html_file(name: str, data: bytes, source: Optional[str] = None) -> Dict[str, Any]:
    raw = _decode(data)
    if not source:
        source = "notion" if re.search(r"notion", raw[:20000], re.I) else "google-docs"
    content, title = _html_body_and_title(raw)
    return {"title": title or _clean_filename_title(name), "content": content, "tags": ["imported", source]}


def _safe_zip_name(name: str) -> bool:
    norm = name.replace("\\", "/")
    if norm.startswith("/") or re.match(r"^[a-zA-Z]:", norm):
        return False
    return ".." not in norm.split("/") and not norm.startswith("__MACOSX/")


def _parse_zip(data: bytes) -> Tuple[List[Dict[str, Any]], int]:
    notes: List[Dict[str, Any]] = []
    skipped = 0
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise ValueError("The zip file could not be read.")
    infos = zf.infolist()
    if len(infos) > MAX_ZIP_ENTRIES:
        raise ValueError(f"The zip file has too many entries (max {MAX_ZIP_ENTRIES}).")
    if sum(i.file_size for i in infos) > MAX_ZIP_TOTAL_BYTES:
        raise ValueError("The zip file is too large once extracted (max 50 MB).")
    total_read = 0
    for info in infos:
        if info.is_dir():
            continue
        name = info.filename
        low = name.lower()
        if not _safe_zip_name(name) or not (low.endswith(TEXT_EXTS) or low.endswith(HTML_EXTS)):
            skipped += 1
            continue
        if info.file_size > MAX_ZIP_ENTRY_BYTES:
            skipped += 1
            continue
        with zf.open(info) as fh:
            # Read with a hard cap: declared sizes in the zip header can lie.
            chunk = fh.read(MAX_ZIP_ENTRY_BYTES + 1)
        if len(chunk) > MAX_ZIP_ENTRY_BYTES:
            skipped += 1
            continue
        total_read += len(chunk)
        if total_read > MAX_ZIP_TOTAL_BYTES:
            raise ValueError("The zip file is too large once extracted (max 50 MB).")
        if low.endswith(HTML_EXTS):
            notes.append(_parse_html_file(name, chunk, "notion"))
        else:
            notes.append(_parse_text_file(name, chunk, "notion"))
    return notes, skipped


def _parse_enex_date(value: str) -> Optional[str]:
    try:
        return datetime.strptime(value.strip(), "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).isoformat()
    except Exception:
        return None


def _parse_enex(data: bytes) -> Tuple[List[Dict[str, Any]], int]:
    if not _HAS_DEFUSED and re.search(rb"<!ENTITY", data, re.I):
        raise ValueError("This Evernote file contains entity declarations, which are not allowed.")
    try:
        root = SafeET.fromstring(data)
    except Exception:
        raise ValueError("The Evernote file could not be read.")
    notes: List[Dict[str, Any]] = []
    skipped = 0
    for n in root.iter("note"):
        title = (n.findtext("title") or "").strip() or "Untitled Note"
        enml = n.findtext("content") or ""
        enml = re.sub(r"<\?xml[^>]*\?>|<!DOCTYPE[^>]*>", "", enml, flags=re.I)
        content = sanitize_html(enml)
        tags = ["imported", "evernote"] + [
            t.text.strip()[:40] for t in n.findall("tag") if t.text and t.text.strip()
        ][:10]
        if not content and not title:
            skipped += 1
            continue
        notes.append({
            "title": title,
            "content": content,
            "tags": list(dict.fromkeys(tags)),
            "created_at": _parse_enex_date(n.findtext("created") or ""),
        })
    return notes, skipped


def parse_upload(filename: str, data: bytes) -> Tuple[List[Dict[str, Any]], int]:
    low = (filename or "").lower()
    if low.endswith(".zip"):
        return _parse_zip(data)
    if low.endswith(".enex"):
        return _parse_enex(data)
    if low.endswith(HTML_EXTS):
        return [_parse_html_file(filename, data)], 0
    if low.endswith(TEXT_EXTS):
        return [_parse_text_file(filename, data, "markdown")], 0
    raise ValueError("Unsupported file type. Use .md, .txt, .html, .zip or .enex.")


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

def _serialize(row: Dict[str, Any]) -> Dict[str, Any]:
    out = {}
    for k, v in (row or {}).items():
        if hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        elif isinstance(v, (int, float, str, bool, list, dict)) or v is None:
            out[k] = v
        else:
            out[k] = str(v)
    return out


@router.post("/notes")
async def import_notes(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
    x_org_id: Optional[str] = Header(default=None),
):
    email = resolve_authenticated_email(authorization)
    if not email:
        return JSONResponse(status_code=401, content={"error": "Please sign in to import notes."})
    email = email.strip().lower()
    if not is_user_active(email):
        return JSONResponse(status_code=403, content={"error": "Account is suspended."})
    org_id = (x_org_id or "").strip() or "personal"
    allowed, role = resolve_org_access(email, org_id)
    if not allowed:
        return JSONResponse(status_code=403, content={"error": "Access denied to this organization."})
    if role == "viewer":
        return JSONResponse(status_code=403, content={"error": "Viewer role is read-only in this organization."})

    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        return JSONResponse(status_code=413, content={"error": "File is too large (max 15 MB)."})
    if not data:
        return JSONResponse(status_code=400, content={"error": "The file is empty."})

    try:
        parsed, skipped = parse_upload(file.filename or "", data)
    except ValueError as ve:
        return JSONResponse(status_code=400, content={"error": str(ve)})
    except Exception as e:
        return JSONResponse(status_code=400, content=server_error(e))

    if len(parsed) > MAX_NOTES_PER_IMPORT:
        skipped += len(parsed) - MAX_NOTES_PER_IMPORT
        parsed = parsed[:MAX_NOTES_PER_IMPORT]

    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable."})
    created: List[Dict[str, Any]] = []
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                for n in parsed:
                    content = (n.get("content") or "")[:MAX_NOTE_CHARS]
                    title = (n.get("title") or "Untitled Note")[:200]
                    if not content.strip() and title == "Untitled Note":
                        skipped += 1
                        continue
                    tags = [str(t) for t in (n.get("tags") or ["imported"])]
                    if n.get("created_at"):
                        cur.execute(
                            """
                            INSERT INTO public.notes (user_email, org_id, title, content, folder, tags, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *;
                            """,
                            (email, org_id, title, content, "Imported", tags, n["created_at"]),
                        )
                    else:
                        cur.execute(
                            """
                            INSERT INTO public.notes (user_email, org_id, title, content, folder, tags)
                            VALUES (%s, %s, %s, %s, %s, %s) RETURNING *;
                            """,
                            (email, org_id, title, content, "Imported", tags),
                        )
                    created.append(_serialize(cur.fetchone()))
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))

    log_audit(email, "notes.import", "notes", "", {"file": (file.filename or "")[:120], "imported": len(created)}, org_id=org_id)
    return {"imported": len(created), "skipped": skipped, "notes": created}
