"""
Document Center module.

Plantillas Word reutilizables, correspondencia cruzada, generacion masiva,
salida DOCX/PDF, revision, firma y trazabilidad historica.
"""

from __future__ import annotations

import base64
import csv
import io
import json
import os
import re
import shutil
import tempfile
import unicodedata
import zipfile
from datetime import datetime
from pathlib import Path
from subprocess import DEVNULL, run
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlencode, urlparse
from xml.etree import ElementTree as ET

import requests
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

try:
    from pypdf import PdfReader, PdfWriter
except Exception:  # pragma: no cover - dependency fallback for older installs
    try:
        from PyPDF2 import PdfReader, PdfWriter
    except Exception:  # pragma: no cover
        PdfReader = None
        PdfWriter = None

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType
from core.config import settings
from core.time_utils import utc_now, utc_now_iso, utc_strftime
from modules.signature.signature_support import (
    default_signature_positions,
    extract_pdf_layout,
    normalize_signature_positions,
    sha256_hex,
)


TEMPLATE_STATUSES = ("draft", "active", "archived")
DATA_SOURCE_TYPES = ("manual_json", "csv_text", "google_sheet")
BATCH_STATUSES = ("draft", "processing", "completed", "completed_with_errors", "error")
GENERATED_DOCUMENT_STATUSES = (
    "generated",
    "ready_for_review",
    "approved",
    "signature_pending",
    "signed",
    "closed",
    "error",
)
TARGET_MODULES = ("general", "hr", "payroll", "safety", "crm", "quotes", "recruitment", "inventory")
TEMPLATE_SCOPE_TYPES = ("general_empresa", "general_cliente", "especifica_cliente_oc")
TEMPLATE_SUBJECT_TYPES = ("trabajador", "empresa", "cliente", "oc", "mixto")
PLACEHOLDER_VALIDATION_STATUSES = ("pending", "valid", "invalid")
EVENT_TYPES = (
    "generated",
    "viewed",
    "download_source",
    "download_doc",
    "download_docx",
    "download_pdf",
    "approved",
    "signature_layout_updated",
    "signature_requested",
    "signed",
    "closed",
    "error",
)
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
DOC_MIME = "application/msword"
PDF_MIME = "application/pdf"
SUPPORTED_TEMPLATE_FORMATS = ("docx", "doc", "pdf")
WORD_TEMPLATE_FORMATS = ("docx", "doc")
CONVERSION_STATUSES = ("pending", "ready", "failed", "not_required")
MIME_BY_FORMAT = {
    "docx": DOCX_MIME,
    "doc": DOC_MIME,
    "pdf": PDF_MIME,
}
EXTENSION_BY_MIME = {
    DOCX_MIME: "docx",
    DOC_MIME: "doc",
    PDF_MIME: "pdf",
    "application/x-msword": "doc",
}
PLACEHOLDER_RE = re.compile(r"<<\s*([^<>]+?)\s*>>")
RAW_PLACEHOLDER_RE = re.compile(r"<<\s*([^<>]+?)\s*>>")
DOCX_XML_EXACT_PATHS = (
    "word/document.xml",
    "word/footnotes.xml",
    "word/endnotes.xml",
    "word/comments.xml",
    "word/glossary/document.xml",
)
DOCX_XML_PREFIXES = (
    "word/header",
    "word/footer",
    "word/commentsExtended",
)
WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
NS = {"w": WORD_NAMESPACE}

ET.register_namespace("w", WORD_NAMESPACE)


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if callable(value):
        return value().isoformat()
    return str(value)


def _safe_int(value: Any, default: Optional[int] = 0) -> Optional[int]:
    try:
        if value in (None, ""):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "on", "si")


def _normalize_str_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        parts = []
        for raw in value.replace("\r", "\n").replace(",", "\n").split("\n"):
            item = raw.strip()
            if item:
                parts.append(item)
        return parts
    return [str(value).strip()] if str(value).strip() else []


def _normalize_signature_roles(value: Any, default_email: str = "", default_name: str = "") -> List[Dict[str, Any]]:
    if value is None:
        value = []
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            value = parsed if isinstance(parsed, list) else []
        except Exception:
            value = []
    if not isinstance(value, list):
        value = []

    roles: List[Dict[str, Any]] = []
    seen = set()
    for index, raw_item in enumerate(value, start=1):
        if isinstance(raw_item, str):
            raw_item = {"role_key": raw_item, "signer_name": raw_item}
        if not isinstance(raw_item, dict):
            continue
        role_key = str(raw_item.get("role_key") or raw_item.get("key") or f"firmante_{index}").strip()
        if not role_key:
            role_key = f"firmante_{index}"
        if role_key in seen:
            role_key = f"{role_key}_{index}"
        seen.add(role_key)
        roles.append(
            {
                "role_key": role_key,
                "signer_name": str(raw_item.get("signer_name") or raw_item.get("name") or role_key).strip(),
                "signer_email": str(
                    raw_item.get("signer_email") or raw_item.get("email") or default_email or ""
                ).strip(),
                "signing_order": _safe_int(raw_item.get("signing_order") or raw_item.get("order"), index) or index,
            }
        )

    if not roles:
        roles = [
            {
                "role_key": "trabajador",
                "signer_name": default_name or "Trabajador",
                "signer_email": default_email or "",
                "signing_order": 1,
            }
        ]
    roles.sort(key=lambda item: (_safe_int(item.get("signing_order"), 0) or 0, item.get("role_key") or ""))
    return roles


def _slugify(value: Any, fallback: str = "documento") -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", str(value or "").strip())
    cleaned = cleaned.strip("_")
    return cleaned[:80] or fallback


def _slugify_code(value: Any, fallback: str = "REQ") -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", str(value or "").strip().upper()).strip("_")
    return cleaned[:60] or fallback


def _normalize_key(value: Any) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or "").strip().lower())
    ascii_text = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", "", ascii_text)


def _b64encode(data: bytes) -> str:
    return base64.b64encode(data).decode("utf-8")


def _b64decode(data: str) -> bytes:
    return base64.b64decode(data.encode("utf-8"))


def _minimal_docx_from_paragraphs(paragraphs: List[str]) -> bytes:
    body_parts: List[str] = []
    for paragraph in paragraphs:
        safe = (
            str(paragraph or "")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
        body_parts.append(
            '<w:p><w:r><w:t xml:space="preserve">'
            + safe
            + "</w:t></w:r></w:p>"
        )
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>"
        + "".join(body_parts)
        + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'
        + "</w:body></w:document>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document_xml)
    return buffer.getvalue()


def _hash_bytes(data: bytes) -> str:
    return sha256_hex(data or b"")


def _normalize_template_format(value: Any, fallback: str = "docx") -> str:
    fmt = str(value or "").strip().lower().lstrip(".")
    if fmt in SUPPORTED_TEMPLATE_FORMATS:
        return fmt
    return fallback if fallback in SUPPORTED_TEMPLATE_FORMATS else "docx"


def _format_from_upload(filename: Any = "", mime_type: Any = "") -> str:
    suffix = Path(str(filename or "")).suffix.lower().lstrip(".")
    if suffix in SUPPORTED_TEMPLATE_FORMATS:
        return suffix
    return EXTENSION_BY_MIME.get(str(mime_type or "").strip().lower(), "docx")


def _mime_for_format(fmt: str) -> str:
    return MIME_BY_FORMAT.get(_normalize_template_format(fmt), DOCX_MIME)


def _converter_error_message() -> str:
    return (
        "LibreOffice/soffice is required for faithful Word/PDF conversion. "
        "Configure DOCUMENT_CONVERTER_PATH or install LibreOffice and add soffice to PATH."
    )


def _resolve_soffice_path() -> Optional[str]:
    configured = str(getattr(settings, "document_converter_path", "") or os.getenv("DOCUMENT_CONVERTER_PATH", "")).strip()
    if configured and Path(configured).exists():
        return configured
    found = shutil.which("soffice") or shutil.which("soffice.exe")
    if found:
        return found
    for candidate in (
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        "/usr/bin/soffice",
        "/usr/local/bin/soffice",
        "/opt/libreoffice/program/soffice",
    ):
        if Path(candidate).exists():
            return candidate
    return None


def _convert_with_soffice(source_bytes: bytes, source_ext: str, target_ext: str) -> bytes:
    source_ext = _normalize_template_format(source_ext, "docx")
    target_ext = _normalize_template_format(target_ext, "pdf")
    soffice_path = _resolve_soffice_path()
    if not soffice_path:
        raise ValidationError(_converter_error_message())
    if not source_bytes:
        raise ValidationError("Source document is empty")

    with tempfile.TemporaryDirectory() as tmp_dir:
        source_path = Path(tmp_dir) / f"source.{source_ext}"
        source_path.write_bytes(source_bytes)
        result = run(
            [
                soffice_path,
                "--headless",
                "--convert-to",
                target_ext,
                "--outdir",
                tmp_dir,
                str(source_path),
            ],
            stdout=DEVNULL,
            stderr=DEVNULL,
            check=False,
        )
        if result.returncode != 0:
            raise ValidationError(f"LibreOffice could not convert {source_ext.upper()} to {target_ext.upper()}")
        converted_path = Path(tmp_dir) / f"source.{target_ext}"
        if not converted_path.exists():
            matches = list(Path(tmp_dir).glob(f"*.{target_ext}"))
            converted_path = matches[0] if matches else converted_path
        if not converted_path.exists():
            raise ValidationError(f"Converted {target_ext.upper()} file was not created")
        return converted_path.read_bytes()


def _is_docx_xml_part(path: str) -> bool:
    if path in DOCX_XML_EXACT_PATHS:
        return True
    if not (path.startswith("word/") and path.endswith(".xml")):
        return False
    return any(path.startswith(prefix) for prefix in DOCX_XML_PREFIXES)


def _safe_parse_xml(data: bytes) -> Optional[ET.Element]:
    try:
        return ET.fromstring(data)
    except Exception:
        return None


def _extract_placeholders(text: str) -> List[str]:
    found = []
    seen = set()
    for match in PLACEHOLDER_RE.findall(text or ""):
        key = str(match).strip()
        if key and key not in seen:
            seen.add(key)
            found.append(key)
    return found


def _extract_invalid_placeholders(text: str) -> List[str]:
    invalid = []
    seen = set()
    for raw_key in RAW_PLACEHOLDER_RE.findall(text or ""):
        key = str(raw_key or "").strip()
        if key:
            continue
        if key not in seen:
            seen.add(key)
            invalid.append(key)
    return invalid


def _replace_placeholders(text: str, values: Dict[str, Any]) -> str:
    normalized_values = {
        _normalize_key(key): value
        for key, value in (values or {}).items()
        if str(key or "").strip()
    }

    def _resolver(match: re.Match[str]) -> str:
        key = match.group(1).strip()
        value = values.get(key, "")
        if value in (None, ""):
            value = normalized_values.get(_normalize_key(key), "")
        if value is None:
            return ""
        return str(value)

    return PLACEHOLDER_RE.sub(_resolver, text or "")


def _extract_docx_preview_and_keys(template_bytes: bytes) -> Tuple[List[str], str]:
    placeholders: List[str] = []
    preview_chunks: List[str] = []
    seen = set()

    with zipfile.ZipFile(io.BytesIO(template_bytes), "r") as zip_file:
        for path in zip_file.namelist():
            if not _is_docx_xml_part(path):
                continue
            xml_bytes = zip_file.read(path)
            root = _safe_parse_xml(xml_bytes)
            if root is None:
                continue
            for paragraph in root.findall(".//w:p", NS):
                texts = [node.text or "" for node in paragraph.findall(".//w:t", NS)]
                paragraph_text = "".join(texts).strip()
                if paragraph_text:
                    preview_chunks.append(paragraph_text)
                for key in _extract_placeholders(paragraph_text):
                    if key not in seen:
                        seen.add(key)
                        placeholders.append(key)

    return placeholders, "\n".join(preview_chunks[:120])


def _replace_placeholders_in_text_nodes(
    text_nodes: List[ET.Element],
    values: Dict[str, Any],
) -> Tuple[str, bool]:
    if not text_nodes:
        return "", False
    original_text = "".join(node.text or "" for node in text_nodes)
    matches = list(PLACEHOLDER_RE.finditer(original_text))
    if not matches:
        return original_text, False

    node_texts = [node.text or "" for node in text_nodes]

    def _node_for_offset(offset: int) -> Tuple[int, int]:
        cursor = 0
        for index, text in enumerate(node_texts):
            next_cursor = cursor + len(text)
            if offset <= next_cursor:
                return index, max(0, offset - cursor)
            cursor = next_cursor
        return len(node_texts) - 1, len(node_texts[-1])

    for match in reversed(matches):
        replacement = _replace_placeholders(match.group(0), values)
        start_node, start_offset = _node_for_offset(match.start())
        end_node, end_offset = _node_for_offset(match.end())
        if start_node == end_node:
            text = node_texts[start_node]
            node_texts[start_node] = text[:start_offset] + replacement + text[end_offset:]
            continue

        start_text = node_texts[start_node]
        end_text = node_texts[end_node]
        node_texts[start_node] = start_text[:start_offset] + replacement
        for index in range(start_node + 1, end_node):
            node_texts[index] = ""
        node_texts[end_node] = end_text[end_offset:]

    for node, text in zip(text_nodes, node_texts):
        node.text = text
        if text.startswith(" ") or text.endswith(" "):
            node.set(XML_SPACE, "preserve")
        elif XML_SPACE in node.attrib:
            node.attrib.pop(XML_SPACE, None)
    return "".join(node_texts), True


def _merge_docx(template_bytes: bytes, values: Dict[str, Any]) -> Tuple[bytes, str]:
    input_zip = zipfile.ZipFile(io.BytesIO(template_bytes), "r")
    output_buffer = io.BytesIO()
    preview_chunks: List[str] = []

    with zipfile.ZipFile(output_buffer, "w", zipfile.ZIP_DEFLATED) as output_zip:
        for item in input_zip.infolist():
            data = input_zip.read(item.filename)
            if _is_docx_xml_part(item.filename):
                try:
                    root = ET.fromstring(data)
                    for paragraph in root.findall(".//w:p", NS):
                        text_nodes = paragraph.findall(".//w:t", NS)
                        if not text_nodes:
                            continue
                        original_text = "".join(node.text or "" for node in text_nodes)
                        replaced_text, changed = _replace_placeholders_in_text_nodes(text_nodes, values)
                        if not changed:
                            replaced_text = original_text
                        if replaced_text.strip():
                            preview_chunks.append(replaced_text.strip())
                    data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
                except Exception:
                    pass
            output_zip.writestr(item, data)

    input_zip.close()
    return output_buffer.getvalue(), "\n".join(preview_chunks[:200])


def _extract_pdf_fields(pdf_bytes: bytes) -> List[str]:
    if not pdf_bytes or PdfReader is None:
        return []
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        fields = reader.get_fields() or {}
        return [str(name) for name in fields.keys() if str(name or "").strip()]
    except Exception:
        return []


def _merge_pdf_fields(pdf_bytes: bytes, values: Dict[str, Any]) -> Tuple[bytes, str]:
    if not pdf_bytes:
        raise ValidationError("PDF template is empty")
    if PdfReader is None or PdfWriter is None:
        raise ValidationError("pypdf is required to process PDF templates")

    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()
    normalized_values = {
        _normalize_key(key): "" if value is None else str(value)
        for key, value in (values or {}).items()
        if str(key or "").strip()
    }
    raw_fields = reader.get_fields() or {}
    field_values: Dict[str, str] = {}
    preview_lines: List[str] = []
    for field_name in raw_fields.keys():
        value = values.get(field_name)
        if value in (None, ""):
            value = normalized_values.get(_normalize_key(field_name), "")
        value = "" if value is None else str(value)
        field_values[str(field_name)] = value
        preview_lines.append(f"{field_name}: {value}")

    for page in reader.pages:
        writer.add_page(page)
    if field_values:
        try:
            writer.set_need_appearances_writer(True)
        except Exception:
            pass
        for page in writer.pages:
            writer.update_page_form_field_values(page, field_values)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue(), "\n".join(preview_lines[:200])


def _render_pdf_from_text(title: str, preview_text: str, extra_lines: Optional[List[str]] = None) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin = 42
    y = height - margin

    pdf.setTitle(title or "documento")
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(margin, y, title or "Documento")
    y -= 24

    pdf.setFont("Helvetica", 9)
    for line in extra_lines or []:
        for wrapped in simpleSplit(line, "Helvetica", 9, width - margin * 2):
            if y < margin:
                pdf.showPage()
                y = height - margin
                pdf.setFont("Helvetica", 9)
            pdf.drawString(margin, y, wrapped)
            y -= 13

    if extra_lines:
        y -= 4

    pdf.setFont("Helvetica", 10)
    for paragraph in (preview_text or "").splitlines():
        content = paragraph.strip() or " "
        for wrapped in simpleSplit(content, "Helvetica", 10, width - margin * 2):
            if y < margin:
                pdf.showPage()
                y = height - margin
                pdf.setFont("Helvetica", 10)
            pdf.drawString(margin, y, wrapped)
            y -= 14
        y -= 2

    pdf.save()
    return buffer.getvalue()


def _build_pdf(title: str, docx_bytes: bytes, preview_text: str, extra_lines: Optional[List[str]] = None) -> bytes:
    try:
        return _convert_with_soffice(docx_bytes, "docx", "pdf")
    except Exception:
        return _render_pdf_from_text(title, preview_text, extra_lines=extra_lines)


def _normalize_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        normalized.append({str(key).strip(): value for key, value in row.items()})
    return normalized


def _parse_csv_rows(csv_text: str) -> List[Dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(csv_text or ""))
    return _normalize_rows([dict(row) for row in reader])


def _normalize_google_sheet_csv_url(url: str) -> str:
    parsed = urlparse(url or "")
    if not parsed.scheme or not parsed.netloc:
        raise ValidationError("Google Sheet URL is required")
    if "output=csv" in url or "tqx=out:csv" in url:
        return url

    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
    if not match:
        raise ValidationError("Google Sheet URL is not valid")

    spreadsheet_id = match.group(1)
    query = parse_qs(parsed.query)
    gid = query.get("gid", [None])[0]
    fragment_gid = None
    if parsed.fragment:
        fragment_query = parse_qs(parsed.fragment.replace("#", ""))
        fragment_gid = fragment_query.get("gid", [None])[0]
        if not fragment_gid:
            gid_match = re.search(r"gid=([0-9]+)", parsed.fragment)
            fragment_gid = gid_match.group(1) if gid_match else None
    gid = gid or fragment_gid or "0"
    return (
        f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?"
        + urlencode({"format": "csv", "gid": gid})
    )


def _load_rows_from_source(source_type: str, payload: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    if source_type == "manual_json":
        raw_rows = payload.get("rows")
        if isinstance(raw_rows, str):
            raw_rows = json.loads(raw_rows or "[]")
        rows = _normalize_rows(raw_rows or [])
        return rows, {"source_type": source_type, "row_count": len(rows)}

    if source_type == "csv_text":
        rows = _parse_csv_rows(payload.get("csv_text") or "")
        return rows, {"source_type": source_type, "row_count": len(rows)}

    if source_type == "google_sheet":
        source_url = _normalize_google_sheet_csv_url(payload.get("source_url") or "")
        response = requests.get(source_url, timeout=20)
        response.raise_for_status()
        rows = _parse_csv_rows(response.text)
        return rows, {"source_type": source_type, "row_count": len(rows), "source_url": source_url}

    raise ValidationError(f"Unsupported data source type: {source_type}")


def _preview_rows(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    columns: List[str] = []
    seen = set()
    for row in rows:
        for key in row.keys():
            key = str(key).strip()
            if key and key not in seen:
                seen.add(key)
                columns.append(key)
    return {"columns": columns, "sample_rows": rows[:5], "row_count": len(rows)}


def _auto_mapping(placeholders: List[str], columns: List[str]) -> Dict[str, str]:
    by_normalized = {_normalize_key(column): column for column in columns}
    mapping: Dict[str, str] = {}
    for placeholder in placeholders:
        mapped = by_normalized.get(_normalize_key(placeholder))
        if mapped:
            mapping[placeholder] = mapped
    return mapping


def _value_for_column(row: Dict[str, Any], column_name: str) -> Any:
    if column_name in row:
        return row[column_name]
    normalized_column = _normalize_key(column_name)
    for key, value in row.items():
        if _normalize_key(key) == normalized_column:
            return value
    return None


def _merge_scalar(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join([str(item).strip() for item in value if str(item).strip()])
    if isinstance(value, bool):
        return "Si" if value else "No"
    return value


def _flatten_context(prefix: str, payload: Dict[str, Any], target: Dict[str, Any]) -> None:
    if not isinstance(payload, dict):
        return
    for key, value in payload.items():
        if value is None:
            continue
        if isinstance(value, dict):
            _flatten_context(f"{prefix}.{key}", value, target)
            _flatten_context(f"{prefix}_{key}", value, target)
            continue
        scalar = _merge_scalar(value)
        target[f"{prefix}.{key}"] = scalar
        target[f"{prefix}_{key}"] = scalar


def _build_merge_data(
    row: Dict[str, Any],
    mapping: Dict[str, str],
    template: "DocumentTemplate",
    row_index: int,
    batch_name: str,
) -> Dict[str, Any]:
    values: Dict[str, Any] = {
        str(key).strip(): _merge_scalar(value)
        for key, value in (row or {}).items()
        if str(key or "").strip()
    }
    for placeholder in template.placeholder_keys or []:
        column_name = mapping.get(placeholder) or placeholder
        values[placeholder] = _value_for_column(row, column_name)

    values.setdefault("row_index", row_index)
    values.setdefault("template_name", template.name)
    values.setdefault("batch_name", batch_name)
    values.setdefault("generated_at", utc_strftime("%Y-%m-%d %H:%M"))
    return values


def _derive_row_context(row: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    def _by_field(config_key: str) -> Optional[Any]:
        column_name = payload.get(config_key)
        if not column_name:
            return None
        return _value_for_column(row, str(column_name))

    recipient_email = _by_field("recipient_email_column") or row.get("email") or row.get("correo")
    recipient_name = _by_field("recipient_name_column") or row.get("nombre") or row.get("name")
    row_key = _by_field("row_key_column") or row.get("id") or row.get("rut") or row.get("dni")
    employee_id = _safe_int(_by_field("employee_id_column"), None)
    customer_id = _safe_int(_by_field("customer_id_column"), None)
    service_type_id = _safe_int(_by_field("service_type_id_column"), None)
    target_record_id = _safe_int(_by_field("target_record_id_column"), None)

    return {
        "recipient_email": str(recipient_email or "").strip(),
        "recipient_name": str(recipient_name or "").strip(),
        "row_key": str(row_key or row.get("id") or "").strip(),
        "employee_id": employee_id,
        "customer_id": customer_id,
        "service_type_id": service_type_id,
        "target_record_id": target_record_id,
    }


class DocumentTemplate(BaseModel, AuditMixin):
    __tablename__ = "document_center_templates"
    __displayname__ = "name"

    name = Column(ColumnType.STRING, required=True, label="Name")
    description = Column(ColumnType.TEXT, label="Description")
    category = Column(ColumnType.STRING, default="general", label="Category")
    document_type = Column(ColumnType.STRING, default="general", label="Document Type")
    target_module = Column(ColumnType.STRING, default="general", label="Target Module")
    scope_type = Column(
        ColumnType.STRING,
        default="general_empresa",
        label="Scope Type",
    )
    subject_type = Column(
        ColumnType.STRING,
        default="trabajador",
        label="Subject Type",
    )
    status = Column(ColumnType.STRING, default="draft", label="Status")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    customer_id = Column(ColumnType.INTEGER, label="Customer")
    service_order_id = Column(ColumnType.INTEGER, label="Service Order")
    service_type_id = Column(ColumnType.INTEGER, label="Service Type")
    requires_signature = Column(ColumnType.BOOLEAN, default=False, label="Requires Signature")
    auto_register_accreditation = Column(
        ColumnType.BOOLEAN, default=False, label="Auto Register Accreditation"
    )
    accreditation_requirement_code = Column(
        ColumnType.STRING, label="Accreditation Requirement Code"
    )
    accreditation_category = Column(
        ColumnType.STRING, default="other", label="Accreditation Category"
    )
    filename_pattern = Column(ColumnType.STRING, label="Filename Pattern")
    original_filename = Column(ColumnType.STRING, label="Original Filename")
    template_mime = Column(ColumnType.STRING, default=DOCX_MIME, label="Template MIME")
    source_format = Column(ColumnType.STRING, default="docx", label="Source Format")
    original_template_data = Column(ColumnType.TEXT, label="Original Template Data")
    original_file_hash = Column(ColumnType.STRING, label="Original File Hash")
    original_file_size = Column(ColumnType.INTEGER, default=0, label="Original File Size")
    conversion_status = Column(ColumnType.STRING, default="pending", label="Conversion Status")
    conversion_error = Column(ColumnType.TEXT, label="Conversion Error")
    available_formats = Column(ColumnType.JSON, default=[], label="Available Formats")
    template_data = Column(ColumnType.TEXT, required=True, label="Template Data")
    template_pdf_data = Column(ColumnType.TEXT, label="Template PDF Data")
    template_pdf_layout = Column(ColumnType.JSON, default=[], label="Template PDF Layout")
    signature_layout = Column(ColumnType.JSON, default=[], label="Template Signature Layout")
    signature_roles = Column(ColumnType.JSON, default=[], label="Signature Roles")
    signature_layout_confirmed = Column(
        ColumnType.BOOLEAN,
        default=False,
        label="Template Signature Layout Confirmed",
    )
    placeholder_keys = Column(ColumnType.JSON, default=[], label="Placeholder Keys")
    placeholder_validation_status = Column(
        ColumnType.STRING,
        default="pending",
        label="Placeholder Validation Status",
    )
    invalid_placeholders = Column(ColumnType.JSON, default=[], label="Invalid Placeholders")
    preview_text = Column(ColumnType.TEXT, label="Preview Text")
    tags = Column(ColumnType.JSON, default=[], label="Tags")

    def validate(self):
        super().validate()
        if not (self.name or "").strip():
            raise ValidationError("Template name is required")
        self.scope_type = self.scope_type or "general_empresa"
        self.subject_type = self.subject_type or "trabajador"
        self.placeholder_validation_status = self.placeholder_validation_status or "pending"
        self.source_format = _normalize_template_format(self.source_format or _format_from_upload(self.original_filename, self.template_mime))
        self.template_mime = self.template_mime or _mime_for_format(self.source_format)
        if not self.original_template_data and self.template_data:
            self.original_template_data = self.template_data
        if not self.original_file_hash and self.original_template_data:
            try:
                original_bytes = _b64decode(self.original_template_data)
                self.original_file_hash = _hash_bytes(original_bytes)
                self.original_file_size = len(original_bytes)
            except Exception:
                self.original_file_hash = self.original_file_hash or ""
        self.available_formats = self.available_formats or []
        self.conversion_status = self.conversion_status or "pending"
        if self.status not in TEMPLATE_STATUSES:
            raise ValidationError(f"Template status must be one of: {', '.join(TEMPLATE_STATUSES)}")
        if self.target_module not in TARGET_MODULES:
            raise ValidationError(f"Target module must be one of: {', '.join(TARGET_MODULES)}")
        if self.scope_type not in TEMPLATE_SCOPE_TYPES:
            raise ValidationError(f"Scope type must be one of: {', '.join(TEMPLATE_SCOPE_TYPES)}")
        if self.subject_type not in TEMPLATE_SUBJECT_TYPES:
            raise ValidationError(
                f"Subject type must be one of: {', '.join(TEMPLATE_SUBJECT_TYPES)}"
            )
        if self.placeholder_validation_status not in PLACEHOLDER_VALIDATION_STATUSES:
            raise ValidationError(
                "Placeholder validation status must be one of: "
                + ", ".join(PLACEHOLDER_VALIDATION_STATUSES)
            )
        if self.source_format not in SUPPORTED_TEMPLATE_FORMATS:
            raise ValidationError(f"Template format must be one of: {', '.join(SUPPORTED_TEMPLATE_FORMATS)}")
        if self.conversion_status not in CONVERSION_STATUSES:
            raise ValidationError(
                "Conversion status must be one of: " + ", ".join(CONVERSION_STATUSES)
            )
        if not self.template_data:
            raise ValidationError("Template file is required")
        self.template_pdf_layout = self.template_pdf_layout or []
        self.signature_roles = self.signature_roles or []
        self.invalid_placeholders = self.invalid_placeholders or []
        if self.requires_signature and self.template_pdf_layout:
            self.signature_layout = normalize_signature_positions(
                self.signature_layout or default_signature_positions(self.template_pdf_layout),
                self.template_pdf_layout,
            )
            self.signature_layout_confirmed = bool(self.signature_layout_confirmed)
        else:
            self.signature_layout = self.signature_layout or []
            self.signature_layout_confirmed = not self.requires_signature

    def to_dict(self, include_content: bool = False) -> Dict[str, Any]:
        data = {
            "id": self.id,
            "name": self.name or "",
            "description": self.description or "",
            "category": self.category or "general",
            "document_type": self.document_type or "general",
            "target_module": self.target_module or "general",
            "scope_type": self.scope_type or "general_empresa",
            "subject_type": self.subject_type or "trabajador",
            "status": self.status or "draft",
            "company_id": self.company_id,
            "customer_id": self.customer_id,
            "service_order_id": self.service_order_id,
            "service_type_id": self.service_type_id,
            "requires_signature": bool(self.requires_signature),
            "auto_register_accreditation": bool(self.auto_register_accreditation),
            "accreditation_requirement_code": self.accreditation_requirement_code or "",
            "accreditation_category": self.accreditation_category or "other",
            "filename_pattern": self.filename_pattern or "",
            "original_filename": self.original_filename or "",
            "template_mime": self.template_mime or DOCX_MIME,
            "source_format": self.source_format or "docx",
            "original_file_hash": self.original_file_hash or "",
            "original_file_size": self.original_file_size or 0,
            "conversion_status": self.conversion_status or "pending",
            "conversion_error": self.conversion_error or "",
            "available_formats": self.available_formats or [],
            "template_pdf_layout": self.template_pdf_layout or [],
            "signature_layout": self.signature_layout or [],
            "signature_roles": self.signature_roles or [],
            "signature_layout_confirmed": bool(self.signature_layout_confirmed),
            "placeholder_keys": self.placeholder_keys or [],
            "placeholder_validation_status": self.placeholder_validation_status or "pending",
            "invalid_placeholders": self.invalid_placeholders or [],
            "preview_text": self.preview_text or "",
            "tags": self.tags or [],
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }
        if include_content:
            data["template_data"] = self.template_data
            data["original_template_data"] = self.original_template_data
            data["template_pdf_data"] = self.template_pdf_data
        return data


class DocumentBatch(BaseModel, AuditMixin):
    __tablename__ = "document_center_batches"
    __displayname__ = "name"

    name = Column(ColumnType.STRING, required=True, label="Name")
    template_id = Column(ColumnType.INTEGER, required=True, label="Template")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    source_type = Column(ColumnType.STRING, required=True, label="Source Type")
    source_name = Column(ColumnType.STRING, label="Source Name")
    source_url = Column(ColumnType.STRING, label="Source URL")
    source_columns = Column(ColumnType.JSON, default=[], label="Source Columns")
    mapping = Column(ColumnType.JSON, default={}, label="Mapping")
    rows_processed = Column(ColumnType.INTEGER, default=0, label="Rows Processed")
    rows_succeeded = Column(ColumnType.INTEGER, default=0, label="Rows Succeeded")
    rows_failed = Column(ColumnType.INTEGER, default=0, label="Rows Failed")
    target_module = Column(ColumnType.STRING, default="general", label="Target Module")
    target_record_id = Column(ColumnType.INTEGER, label="Target Record")
    customer_id = Column(ColumnType.INTEGER, label="Customer")
    service_type_id = Column(ColumnType.INTEGER, label="Service Type")
    created_by = Column(ColumnType.INTEGER, label="Created By")
    notes = Column(ColumnType.TEXT, label="Notes")

    def validate(self):
        super().validate()
        if self.status not in BATCH_STATUSES:
            raise ValidationError(f"Batch status must be one of: {', '.join(BATCH_STATUSES)}")
        if self.source_type not in DATA_SOURCE_TYPES:
            raise ValidationError(f"Source type must be one of: {', '.join(DATA_SOURCE_TYPES)}")
        if self.target_module not in TARGET_MODULES:
            raise ValidationError(f"Target module must be one of: {', '.join(TARGET_MODULES)}")

    def to_dict(self) -> Dict[str, Any]:
        template = getattr(self, "_template_cache", None)
        if template is None and self.template_id:
            template = DocumentTemplate.find_by_id(self.template_id)
        return {
            "id": self.id,
            "name": self.name or "",
            "template_id": self.template_id,
            "template_name": template.name if template else None,
            "company_id": self.company_id,
            "status": self.status or "draft",
            "source_type": self.source_type or "",
            "source_name": self.source_name or "",
            "source_url": self.source_url or "",
            "source_columns": self.source_columns or [],
            "mapping": self.mapping or {},
            "rows_processed": self.rows_processed or 0,
            "rows_succeeded": self.rows_succeeded or 0,
            "rows_failed": self.rows_failed or 0,
            "target_module": self.target_module or "general",
            "target_record_id": self.target_record_id,
            "customer_id": self.customer_id,
            "service_type_id": self.service_type_id,
            "created_by": _safe_int(self._data.get("created_by"), None),
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class GeneratedDocument(BaseModel, AuditMixin):
    __tablename__ = "document_center_generated_documents"
    __displayname__ = "name"

    batch_id = Column(ColumnType.INTEGER, required=True, label="Batch")
    template_id = Column(ColumnType.INTEGER, required=True, label="Template")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    name = Column(ColumnType.STRING, required=True, label="Name")
    output_filename = Column(ColumnType.STRING, required=True, label="Output Filename")
    row_index = Column(ColumnType.INTEGER, default=0, label="Row Index")
    row_key = Column(ColumnType.STRING, label="Row Key")
    recipient_name = Column(ColumnType.STRING, label="Recipient Name")
    recipient_email = Column(ColumnType.STRING, label="Recipient Email")
    employee_id = Column(ColumnType.INTEGER, label="Employee")
    customer_id = Column(ColumnType.INTEGER, label="Customer")
    service_order_id = Column(ColumnType.INTEGER, label="Service Order")
    service_type_id = Column(ColumnType.INTEGER, label="Service Type")
    subject_type = Column(ColumnType.STRING, default="trabajador", label="Subject Type")
    subject_id = Column(ColumnType.INTEGER, label="Subject ID")
    template_scope_type = Column(
        ColumnType.STRING,
        default="general_empresa",
        label="Template Scope Type",
    )
    source_module = Column(ColumnType.STRING, label="Source Module")
    source_record_id = Column(ColumnType.INTEGER, label="Source Record")
    source_label = Column(ColumnType.STRING, label="Source Label")
    target_module = Column(ColumnType.STRING, default="general", label="Target Module")
    target_record_id = Column(ColumnType.INTEGER, label="Target Record")
    source_format = Column(ColumnType.STRING, default="docx", label="Source Format")
    original_file_hash = Column(ColumnType.STRING, label="Original File Hash")
    available_formats = Column(ColumnType.JSON, default=[], label="Available Formats")
    merge_payload = Column(ColumnType.JSON, default={}, label="Merge Payload")
    docx_data = Column(ColumnType.TEXT, label="DOCX Data")
    doc_data = Column(ColumnType.TEXT, label="DOC Data")
    pdf_data = Column(ColumnType.TEXT, label="PDF Data")
    docx_hash = Column(ColumnType.STRING, label="DOCX Hash")
    doc_hash = Column(ColumnType.STRING, label="DOC Hash")
    pdf_hash = Column(ColumnType.STRING, label="PDF Hash")
    conversion_status = Column(ColumnType.STRING, default="ready", label="Conversion Status")
    conversion_error = Column(ColumnType.TEXT, label="Conversion Error")
    pdf_layout = Column(ColumnType.JSON, default=[], label="PDF Layout")
    pdf_layout_hash = Column(ColumnType.STRING, label="PDF Layout Hash")
    template_signature_layout_snapshot = Column(
        ColumnType.JSON,
        default=[],
        label="Template Signature Layout Snapshot",
    )
    signature_roles_snapshot = Column(
        ColumnType.JSON,
        default=[],
        label="Signature Roles Snapshot",
    )
    signature_positions = Column(ColumnType.JSON, default=[], label="Signature Positions")
    signature_layout_confirmed = Column(ColumnType.BOOLEAN, default=False, label="Signature Layout Confirmed")
    preview_text = Column(ColumnType.TEXT, label="Preview Text")
    status = Column(ColumnType.STRING, default="ready_for_review", label="Status")
    requires_signature = Column(ColumnType.BOOLEAN, default=False, label="Requires Signature")
    signature_request_id = Column(ColumnType.INTEGER, label="Signature Request")
    accreditation_document_id = Column(ColumnType.INTEGER, label="Accreditation Document")
    approved_by = Column(ColumnType.INTEGER, label="Approved By")
    approved_at = Column(ColumnType.STRING, label="Approved At")
    signed_at = Column(ColumnType.STRING, label="Signed At")
    closed_by = Column(ColumnType.INTEGER, label="Closed By")
    closed_at = Column(ColumnType.STRING, label="Closed At")
    last_error = Column(ColumnType.TEXT, label="Last Error")
    tags = Column(ColumnType.JSON, default=[], label="Tags")

    def validate(self):
        super().validate()
        self.template_scope_type = self.template_scope_type or "general_empresa"
        self.subject_type = self.subject_type or "trabajador"
        self.source_format = _normalize_template_format(self.source_format or "docx")
        self.available_formats = self.available_formats or []
        self.conversion_status = self.conversion_status or "ready"
        if self.status not in GENERATED_DOCUMENT_STATUSES:
            raise ValidationError(
                "Generated document status must be one of: "
                + ", ".join(GENERATED_DOCUMENT_STATUSES)
            )
        if self.target_module not in TARGET_MODULES:
            raise ValidationError(f"Target module must be one of: {', '.join(TARGET_MODULES)}")
        if self.template_scope_type not in TEMPLATE_SCOPE_TYPES:
            raise ValidationError(
                f"Template scope type must be one of: {', '.join(TEMPLATE_SCOPE_TYPES)}"
            )
        if self.subject_type not in TEMPLATE_SUBJECT_TYPES:
            raise ValidationError(
                f"Subject type must be one of: {', '.join(TEMPLATE_SUBJECT_TYPES)}"
            )
        if self.source_format not in SUPPORTED_TEMPLATE_FORMATS:
            raise ValidationError(f"Source format must be one of: {', '.join(SUPPORTED_TEMPLATE_FORMATS)}")
        if self.conversion_status not in CONVERSION_STATUSES:
            raise ValidationError(
                "Conversion status must be one of: " + ", ".join(CONVERSION_STATUSES)
            )
        self._refresh_pdf_signature_layout()

    def _refresh_pdf_signature_layout(self) -> None:
        if not self.pdf_data:
            self.pdf_layout = self.pdf_layout or []
            self.pdf_layout_hash = self.pdf_layout_hash or ""
            self.signature_positions = self.signature_positions or []
            return
        pdf_bytes = _b64decode(self.pdf_data)
        pdf_hash = sha256_hex(pdf_bytes)
        if pdf_hash != (self.pdf_layout_hash or "") or not self.pdf_layout:
            self.pdf_layout = extract_pdf_layout(pdf_bytes)
            self.pdf_layout_hash = pdf_hash
        if self.requires_signature:
            positions = self.signature_positions or default_signature_positions(self.pdf_layout)
            self.signature_positions = normalize_signature_positions(positions, self.pdf_layout)
            self.signature_layout_confirmed = bool(self.signature_layout_confirmed)
        else:
            self.signature_positions = self.signature_positions or []
            self.signature_layout_confirmed = True

    def to_dict(self, include_content: bool = False) -> Dict[str, Any]:
        template = getattr(self, "_template_cache", None)
        if template is None and self.template_id:
            template = DocumentTemplate.find_by_id(self.template_id)
        batch = getattr(self, "_batch_cache", None)
        if batch is None and self.batch_id:
            batch = DocumentBatch.find_by_id(self.batch_id)
        data = {
            "id": self.id,
            "batch_id": self.batch_id,
            "batch_name": batch.name if batch else None,
            "template_id": self.template_id,
            "template_name": template.name if template else None,
            "company_id": self.company_id,
            "name": self.name or "",
            "output_filename": self.output_filename or "",
            "row_index": self.row_index or 0,
            "row_key": self.row_key or "",
            "recipient_name": self.recipient_name or "",
            "recipient_email": self.recipient_email or "",
            "employee_id": self.employee_id,
            "customer_id": self.customer_id,
            "service_order_id": self.service_order_id,
            "service_type_id": self.service_type_id,
            "subject_type": self.subject_type or "trabajador",
            "subject_id": self.subject_id,
            "template_scope_type": self.template_scope_type or "general_empresa",
            "source_module": self.source_module or "",
            "source_record_id": self.source_record_id,
            "source_label": self.source_label or "",
            "target_module": self.target_module or "general",
            "target_record_id": self.target_record_id,
            "source_format": self.source_format or "docx",
            "original_file_hash": self.original_file_hash or "",
            "available_formats": self.available_formats or [],
            "merge_payload": self.merge_payload or {},
            "preview_text": self.preview_text or "",
            "docx_hash": self.docx_hash or "",
            "doc_hash": self.doc_hash or "",
            "pdf_hash": self.pdf_hash or "",
            "conversion_status": self.conversion_status or "ready",
            "conversion_error": self.conversion_error or "",
            "pdf_layout": self.pdf_layout or [],
            "template_signature_layout_snapshot": self.template_signature_layout_snapshot or [],
            "signature_roles_snapshot": self.signature_roles_snapshot or [],
            "signature_positions": self.signature_positions or [],
            "signature_layout_confirmed": bool(self.signature_layout_confirmed),
            "status": self.status or "ready_for_review",
            "requires_signature": bool(self.requires_signature),
            "signature_request_id": self.signature_request_id,
            "accreditation_document_id": self.accreditation_document_id,
            "approved_by": self.approved_by,
            "approved_at": self.approved_at or "",
            "signed_at": self.signed_at or "",
            "closed_by": self.closed_by,
            "closed_at": self.closed_at or "",
            "last_error": self.last_error or "",
            "tags": self.tags or [],
            "workspace_url": f"/app/cross-correspondence?generated_document_id={self.id}",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }
        if include_content:
            data["docx_data"] = self.docx_data
            data["doc_data"] = self.doc_data
            data["pdf_data"] = self.pdf_data
        return data


class DocumentEventLog(BaseModel, AuditMixin):
    __tablename__ = "document_center_events"
    __displayname__ = "event"

    document_id = Column(ColumnType.INTEGER, required=True, label="Document")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    event = Column(ColumnType.STRING, required=True, label="Event")
    user_id = Column(ColumnType.INTEGER, label="User")
    ip_address = Column(ColumnType.STRING, label="IP Address")
    notes = Column(ColumnType.TEXT, label="Notes")
    metadata = Column(ColumnType.JSON, default={}, label="Metadata")

    def validate(self):
        super().validate()
        if self.event not in EVENT_TYPES:
            raise ValidationError(f"Event must be one of: {', '.join(EVENT_TYPES)}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "document_id": self.document_id,
            "company_id": self.company_id,
            "event": self.event or "",
            "user_id": self.user_id,
            "ip_address": self.ip_address or "",
            "notes": self.notes or "",
            "metadata": self.metadata or {},
            "created_at": _fmt_dt(self._data.get("created_at")),
        }


class DocumentCenterModule(BaseModule):
    name = "document_center"
    version = "1.0.0"
    author = "Your Company"
    description = "Word templates, cross correspondence and signature-ready document center"
    depends = ["base", "signature"]

    def init_module(self):
        self.register_model("document_center.template", DocumentTemplate)
        self.register_model("document_center.batch", DocumentBatch)
        self.register_model("document_center.generated_document", GeneratedDocument)
        self.register_model("document_center.event", DocumentEventLog)

        self.register_route("/document-center/stats", self.get_stats, methods=["GET"], auth_required=True)

        self.register_route("/document-center/templates", self.list_templates, methods=["GET"], auth_required=True)
        self.register_route("/document-center/templates", self.create_template, methods=["POST"], auth_required=True)
        self.register_route("/document-center/templates/{id}", self.get_template, methods=["GET"], auth_required=True)
        self.register_route("/document-center/templates/{id}", self.update_template, methods=["PUT"], auth_required=True)
        self.register_route("/document-center/templates/{id}", self.delete_template, methods=["DELETE"], auth_required=True)
        self.register_route(
            "/document-center/templates/{id}/preview-pdf",
            self.get_template_preview_pdf,
            methods=["GET"],
            auth_required=True,
        )
        self.register_route(
            "/document-center/templates/{id}/signature-layout",
            self.update_template_signature_layout,
            methods=["POST"],
            auth_required=True,
        )
        self.register_route("/document-center/lookups", self.get_lookups, methods=["GET"], auth_required=True)

        self.register_route("/document-center/data-sources/preview", self.preview_data_source, methods=["POST"], auth_required=True)

        self.register_route("/document-center/batches", self.list_batches, methods=["GET"], auth_required=True)
        self.register_route("/document-center/batches/generate", self.generate_batch, methods=["POST"], auth_required=True)
        self.register_route("/document-center/worker-generate", self.generate_worker_documents, methods=["POST"], auth_required=True)
        self.register_route("/document-center/batches/{id}", self.get_batch, methods=["GET"], auth_required=True)

        self.register_route("/document-center/generated", self.list_generated_documents, methods=["GET"], auth_required=True)
        self.register_route("/document-center/generated/{id}", self.get_generated_document, methods=["GET"], auth_required=True)
        self.register_route("/document-center/generated/{id}/content", self.get_generated_content, methods=["GET"], auth_required=True)
        self.register_route("/document-center/generated/{id}/signature-layout", self.update_generated_signature_layout, methods=["POST"], auth_required=True)
        self.register_route("/document-center/generated/{id}/approve", self.approve_document, methods=["POST"], auth_required=True)
        self.register_route("/document-center/generated/{id}/send-signature", self.send_document_to_signature, methods=["POST"], auth_required=True)
        self.register_route("/document-center/generated/{id}/close", self.close_document, methods=["POST"], auth_required=True)
        self.register_route("/document-center/generated/{id}/history", self.get_document_history, methods=["GET"], auth_required=True)

        self._backfill_document_center_metadata()
        self.logger.info("Document center module initialized")

    def _company_id(self) -> Optional[int]:
        user = self.env.user
        return user.company_id if user else None

    def _backfill_document_center_metadata(self) -> None:
        try:
            templates = DocumentTemplate.search([])
            documents = GeneratedDocument.search([])
            template_map = {item.id: item for item in templates if item.id}
            docs_by_template: Dict[int, List[GeneratedDocument]] = {}
            for document in documents:
                if document.template_id:
                    docs_by_template.setdefault(document.template_id, []).append(document)

            for template in templates:
                dirty = False
                if not template.scope_type:
                    template.scope_type = "general_cliente" if template.customer_id else "general_empresa"
                    dirty = True
                if not template.subject_type:
                    template.subject_type = "trabajador"
                    dirty = True
                if not template.placeholder_validation_status:
                    template.placeholder_validation_status = "valid" if template.placeholder_keys else "pending"
                    dirty = True
                if template.requires_signature and not template.signature_roles:
                    template.signature_roles = _normalize_signature_roles([])
                    dirty = True
                if template.requires_signature and not (template.signature_layout or []):
                    source_doc = next(
                        (
                            item
                            for item in docs_by_template.get(template.id, [])
                            if item.signature_positions and item.signature_layout_confirmed
                        ),
                        None,
                    )
                    if source_doc:
                        template.signature_layout = source_doc.signature_positions or []
                        template.signature_roles = source_doc.signature_roles_snapshot or template.signature_roles or []
                        template.signature_layout_confirmed = bool(source_doc.signature_layout_confirmed)
                        if source_doc.pdf_data and not template.template_pdf_data:
                            template.template_pdf_data = source_doc.pdf_data
                            template.template_pdf_layout = source_doc.pdf_layout or []
                        dirty = True
                if template.template_data and (
                    not template.template_pdf_data
                    or not (template.placeholder_keys or [])
                    or (template.placeholder_validation_status or "") in ("pending", "invalid")
                ):
                    self._refresh_template_preview_metadata(template)
                    dirty = True
                if dirty:
                    template.save()

            for document in documents:
                template = template_map.get(document.template_id)
                dirty = False
                if not document.template_scope_type:
                    document.template_scope_type = (
                        template.scope_type
                        if template
                        else "general_cliente"
                        if document.customer_id
                        else "general_empresa"
                    )
                    dirty = True
                if not document.subject_type:
                    document.subject_type = template.subject_type if template else "trabajador"
                    dirty = True
                if not document.subject_id:
                    document.subject_id = (
                        document.employee_id
                        or document.customer_id
                        or document.service_order_id
                        or document.company_id
                    )
                    dirty = True
                if template and not (document.template_signature_layout_snapshot or []):
                    document.template_signature_layout_snapshot = template.signature_layout or []
                    document.signature_roles_snapshot = template.signature_roles or []
                    dirty = True
                if dirty:
                    document.save()
        except Exception as exc:
            self.logger.warning(f"Document Center metadata backfill skipped: {exc}")

    def _tenant_filter(self) -> List[tuple]:
        user = self.env.user
        if user and user.role == "superadmin":
            return []
        return [("company_id", "=", self._company_id())]

    def _ensure_safety_epp_template(self) -> Optional[DocumentTemplate]:
        company_id = self._company_id()
        if not company_id:
            return None
        existing = [
            item
            for item in DocumentTemplate.search([("company_id", "=", company_id)])
            if (item.status or "") == "active"
            and (item.target_module or "") == "safety"
            and (
                _normalize_key(item.document_type or "") == "epp"
                or _normalize_key(item.category or "") == "epp"
                or "epp" in [_normalize_key(tag) for tag in (item.tags or [])]
            )
        ]
        if existing:
            existing.sort(key=lambda item: (item.id or 0))
            return existing[0]

        paragraphs = [
            "REGISTRO DE ENTREGA Y REPOSICION DE EPP",
            "Empresa: <<company_legal_name>>",
            "Proyecto / Codigo: <<project_code>>",
            "Cliente / Mandante: <<customer_name>>",
            "Trabajador: <<employee_name>>",
            "RUT / Identificador: <<employee_rut>>",
            "Cargo: <<position_title>>",
            "Fecha de entrega: <<delivery_date>>",
            "Elementos entregados:",
            "<<delivery_items_multiline>>",
            "Observaciones:",
            "<<notes>>",
            "Declaro recibir los elementos de proteccion personal indicados, comprometiendome a usarlos, cuidarlos y reportar deterioros o perdidas.",
            "Firma trabajador: ______________________________",
            "Firma supervisor / prevencion: ______________________________",
        ]
        docx_bytes = _minimal_docx_from_paragraphs(paragraphs)
        preview_text = "\n".join(paragraphs)
        placeholder_keys = _extract_placeholders(preview_text)
        pdf_bytes = _build_pdf(
            "Registro de entrega de EPP",
            docx_bytes,
            preview_text,
            extra_lines=["Plantilla base fija y adaptable para carpetas de prevencion."],
        )
        template = DocumentTemplate.create(
            {
                "name": "Registro entrega EPP - Prevencion",
                "description": "Plantilla base adaptable para generar entrega o reposicion de EPP desde carpetas de prevencion.",
                "category": "epp",
                "document_type": "epp",
                "target_module": "safety",
                "scope_type": "general_empresa",
                "subject_type": "trabajador",
                "status": "active",
                "company_id": company_id,
                "requires_signature": False,
                "auto_register_accreditation": False,
                "accreditation_requirement_code": "EPP_ENTREGA",
                "accreditation_category": "safety",
                "filename_pattern": "EPP_<<employee_name>>_<<delivery_date>>",
                "original_filename": "registro_entrega_epp.docx",
                "template_mime": DOCX_MIME,
                "source_format": "docx",
                "original_template_data": _b64encode(docx_bytes),
                "original_file_hash": _hash_bytes(docx_bytes),
                "original_file_size": len(docx_bytes),
                "conversion_status": "ready",
                "conversion_error": "",
                "available_formats": ["docx", "pdf", "source"],
                "template_data": _b64encode(docx_bytes),
                "template_pdf_data": _b64encode(pdf_bytes),
                "template_pdf_layout": extract_pdf_layout(pdf_bytes),
                "signature_layout": [],
                "signature_roles": [],
                "signature_layout_confirmed": True,
                "placeholder_keys": placeholder_keys,
                "placeholder_validation_status": "valid",
                "invalid_placeholders": [],
                "preview_text": preview_text,
                "tags": ["epp", "safety", "prevencion"],
            }
        )
        return template

    def _require_access(self) -> Optional[Response]:
        user = self.env.user
        if not user:
            return Response.unauthorized("Authentication required")
        if user.role in ("superadmin", "company_admin"):
            return None
        allowed = set(user.allowed_modules or [])
        if allowed.intersection(
            {
                "document_center",
                "operations",
                "hr",
                "payroll",
                "safety",
                "crm",
                "quotes",
                "recruitment",
                "inventory",
            }
        ):
            return None
        return Response.forbidden("You do not have access to the document center")

    def _template_or_404(self, template_id: Any) -> Tuple[Optional[DocumentTemplate], Optional[Response]]:
        template = DocumentTemplate.find_by_id(_safe_int(template_id))
        if not template or (
            self.env.user.role != "superadmin" and template.company_id != self._company_id()
        ):
            return None, Response.not_found("Template not found")
        return template, None

    def _batch_or_404(self, batch_id: Any) -> Tuple[Optional[DocumentBatch], Optional[Response]]:
        batch = DocumentBatch.find_by_id(_safe_int(batch_id))
        if not batch or (
            self.env.user.role != "superadmin" and batch.company_id != self._company_id()
        ):
            return None, Response.not_found("Batch not found")
        return batch, None

    def _generated_or_404(self, document_id: Any) -> Tuple[Optional[GeneratedDocument], Optional[Response]]:
        document = GeneratedDocument.find_by_id(_safe_int(document_id))
        if not document or (
            self.env.user.role != "superadmin" and document.company_id != self._company_id()
        ):
            return None, Response.not_found("Generated document not found")
        return document, None

    def _log_event(
        self,
        document: GeneratedDocument,
        event: str,
        request: Optional[Request] = None,
        notes: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        try:
            DocumentEventLog.create(
                {
                    "document_id": document.id,
                    "company_id": document.company_id,
                    "event": event,
                    "user_id": self.env.user.id if self.env.user else None,
                    "ip_address": getattr(request, "remote_addr", None) if request else None,
                    "notes": notes or "",
                    "metadata": metadata or {},
                }
            )
        except Exception as exc:
            self.logger.warning(f"Document event log skipped: {exc}")

    def _workspace_url(self, document_id: Any) -> str:
        return f"/app/cross-correspondence?generated_document_id={document_id}"

    def _refresh_template_preview_metadata(
        self,
        template: DocumentTemplate,
        template_bytes: Optional[bytes] = None,
        placeholder_keys: Optional[List[str]] = None,
        preview_text: Optional[str] = None,
    ) -> None:
        source_format = _normalize_template_format(
            template.source_format or _format_from_upload(template.original_filename, template.template_mime)
        )
        template.source_format = source_format
        template.template_mime = template.template_mime or _mime_for_format(source_format)
        original_bytes = (
            template_bytes
            or _b64decode(template.original_template_data or template.template_data or "")
        )
        if original_bytes:
            template.original_template_data = template.original_template_data or _b64encode(original_bytes)
            template.original_file_hash = _hash_bytes(original_bytes)
            template.original_file_size = len(original_bytes)

        available_formats = {"source"}
        template.conversion_error = ""
        if source_format == "pdf":
            pdf_bytes = original_bytes
            fields = _extract_pdf_fields(pdf_bytes)
            template.template_data = _b64encode(pdf_bytes)
            template.template_pdf_data = _b64encode(pdf_bytes)
            template.template_pdf_layout = extract_pdf_layout(pdf_bytes)
            template.placeholder_keys = fields
            template.preview_text = "\n".join([f"Campo PDF: {field}" for field in fields]) or "PDF sin campos editables"
            template.invalid_placeholders = []
            template.placeholder_validation_status = "valid"
            template.conversion_status = "not_required"
            available_formats.add("pdf")
        else:
            docx_bytes = original_bytes
            if source_format == "doc":
                docx_bytes = _convert_with_soffice(original_bytes, "doc", "docx")
                available_formats.add("doc")
            next_placeholder_keys = placeholder_keys
            next_preview_text = preview_text
            if next_placeholder_keys is None or next_preview_text is None:
                next_placeholder_keys, next_preview_text = _extract_docx_preview_and_keys(docx_bytes)
            template.template_data = _b64encode(docx_bytes)
            template.placeholder_keys = next_placeholder_keys or []
            template.preview_text = next_preview_text or ""
            template.invalid_placeholders = _extract_invalid_placeholders(template.preview_text or "")
            template.placeholder_validation_status = (
                "invalid" if template.invalid_placeholders else "valid"
            )
            pdf_bytes = _build_pdf(
                template.name or "Plantilla",
                docx_bytes,
                template.preview_text or "",
                extra_lines=[
                    "Vista previa de plantilla",
                    f"Ambito: {template.scope_type or 'general_empresa'}",
                    f"Sujeto: {template.subject_type or 'trabajador'}",
                ],
            )
            template.template_pdf_data = _b64encode(pdf_bytes)
            template.template_pdf_layout = extract_pdf_layout(pdf_bytes)
            template.conversion_status = "ready"
            available_formats.update({"docx", "pdf"})
        template.available_formats = sorted(available_formats)
        template.signature_roles = _normalize_signature_roles(template.signature_roles or [])
        if template.requires_signature:
            template.signature_layout = normalize_signature_positions(
                template.signature_layout or default_signature_positions(template.template_pdf_layout),
                template.template_pdf_layout,
            )
            template.signature_layout_confirmed = bool(template.signature_layout_confirmed)
        else:
            template.signature_layout = []
            template.signature_layout_confirmed = True

    def _company_payload(self) -> Dict[str, Any]:
        try:
            from modules.base.module_base import Company

            company = Company.find_by_id(self._company_id())
        except Exception:
            company = None
        if not company:
            return {}
        return {
            "id": company.id,
            "name": company.name or "",
            "legal_name": getattr(company, "legal_name", "") or "",
            "email": getattr(company, "email", "") or "",
            "phone": getattr(company, "phone", "") or "",
            "address": getattr(company, "address", "") or "",
            "tax_id": getattr(company, "tax_id", "") or "",
        }

    def _active_contract_for_employee(self, employee_id: Optional[int]):
        if not employee_id:
            return None
        try:
            from modules.hr.module_hr import EmployeeContract
        except Exception:
            return None
        contracts = EmployeeContract.search([("employee_id", "=", employee_id)])
        active = [item for item in contracts if (item.status or "") == "active"]
        ordered = active or contracts
        ordered.sort(
            key=lambda item: (
                item.start_date or "",
                item.id or 0,
            ),
            reverse=True,
        )
        return ordered[0] if ordered else None

    def _resolve_signature_recipient(self, document: GeneratedDocument) -> Tuple[str, str]:
        recipient_name = str(document.recipient_name or "").strip() or f"Documento #{document.id or ''}".strip()
        recipient_email = str(document.recipient_email or "").strip()
        if recipient_email:
            return recipient_email, recipient_name

        if document.employee_id:
            try:
                from modules.hr.module_hr import EmployeeProfile

                employee = EmployeeProfile.find_by_id(int(document.employee_id))
                if employee:
                    recipient_name = str(employee.full_name or recipient_name).strip() or recipient_name
                    recipient_email = str(employee.work_email or employee.personal_email or "").strip()
                    if recipient_email:
                        return recipient_email, recipient_name
            except Exception as exc:
                self.logger.warning(f"Could not resolve worker email for document #{document.id}: {exc}")

        safe_local = "".join(
            char.lower() if char.isalnum() else "."
            for char in (recipient_name or f"documento-{document.id or 'firma'}")
        ).strip(".") or f"documento.{document.id or 'firma'}"
        return f"{safe_local}.{document.id or 'manual'}@firma-local.invalid", recipient_name

    def _payroll_profile_for_employee(self, employee_id: Optional[int]):
        if not employee_id:
            return None
        try:
            from modules.payroll.module_payroll import PayrollProfile
        except Exception:
            return None
        profiles = PayrollProfile.search([("employee_id", "=", employee_id)])
        profiles.sort(key=lambda item: (item.id or 0), reverse=True)
        return profiles[0] if profiles else None

    def _service_type_name(self, service_type_id: Optional[int]) -> str:
        if not service_type_id:
            return ""
        try:
            from modules.crm.module_crm import ServiceType

            service_type = ServiceType.find_by_id(service_type_id)
            return service_type.name if service_type else ""
        except Exception:
            return ""

    def _customer_record(self, customer_id: Optional[int]):
        if not customer_id:
            return None
        try:
            from modules.crm.module_crm import Customer
        except Exception:
            return None
        customer = Customer.find_by_id(customer_id)
        if not customer:
            return None
        if self.env.user.role != "superadmin" and customer.company_id != self._company_id():
            return None
        return customer

    def _lead_record(self, lead_id: Optional[int]):
        if not lead_id:
            return None
        try:
            from modules.crm.module_crm import Lead
        except Exception:
            return None
        lead = Lead.find_by_id(lead_id)
        if not lead:
            return None
        if self.env.user.role != "superadmin" and lead.company_id != self._company_id():
            return None
        return lead

    def _safety_folder_record(self, folder_id: Optional[int]):
        if not folder_id:
            return None
        try:
            from modules.safety.module_safety import SafetyFolder
        except Exception:
            return None
        folder = SafetyFolder.find_by_id(folder_id)
        if not folder:
            return None
        if self.env.user.role != "superadmin" and folder.company_id != self._company_id():
            return None
        return folder

    def _parse_extra_context(self, value: Any) -> Dict[str, Any]:
        if value is None:
            return {}
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value or "{}")
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}
        return {}

    def _template_accreditation_category(self, template: DocumentTemplate) -> str:
        explicit = str(template.accreditation_category or "").strip().lower()
        if explicit:
            return explicit
        document_type = str(template.document_type or "").strip().lower()
        category = str(template.category or "").strip().lower()
        if "contrato" in document_type or "anexo" in document_type or "rrhh" in category:
            return "contractual"
        if "epp" in document_type or "seguridad" in document_type or category == "safety":
            return "safety"
        if "induccion" in document_type or "charla" in document_type:
            return "training"
        return "other"

    def _ensure_accreditation_requirement(
        self, template: DocumentTemplate, customer_id: Optional[int]
    ):
        try:
            from modules.hr.module_hr import AccreditationRequirement
        except Exception:
            return None

        code = _slugify_code(
            template.accreditation_requirement_code or template.name or template.document_type or "REQ"
        )
        requirements = AccreditationRequirement.search([("company_id", "=", self._company_id())])
        for item in requirements:
            if (item.code or "").strip().upper() == code and (item.customer_id or None) == (customer_id or None):
                return item

        try:
            return AccreditationRequirement.create(
                {
                    "name": template.name or template.document_type or "Documento generado",
                    "code": code,
                    "category": self._template_accreditation_category(template),
                    "description": template.description or f"Documento generado desde plantilla {template.name or template.id}.",
                    "company_id": self._company_id(),
                    "customer_id": customer_id,
                    "is_global": not customer_id,
                    "is_mandatory": True,
                    "fulfillment_mode": "template_generated" if template.requires_signature else "hybrid",
                    "accepted_file_types": ["pdf", "docx"],
                    "requires_signature": bool(template.requires_signature),
                    "tracks_expiration": False,
                    "expiration_required": False,
                    "default_validity_days": 0,
                    "warning_days": 0,
                    "display_order": 999,
                }
            )
        except Exception as exc:
            self.logger.warning(f"Accreditation requirement auto-create skipped: {exc}")
            return None

    def _register_generated_in_accreditation(
        self,
        document: GeneratedDocument,
        template: DocumentTemplate,
    ):
        if not template.auto_register_accreditation or not document.employee_id:
            return None
        try:
            from modules.hr.module_hr import EmployeeAccreditationDocument
        except Exception:
            return None

        requirement = self._ensure_accreditation_requirement(template, document.customer_id)
        if not requirement:
            return None

        documents = EmployeeAccreditationDocument.search([("employee_id", "=", document.employee_id)])
        existing = next(
            (
                item
                for item in documents
                if item.requirement_id == requirement.id and item.company_id == document.company_id
            ),
            None,
        )
        notes = (
            f"Documento generado desde correspondencia cruzada. "
            f"Origen: {document.source_module or document.target_module or 'document_center'}."
        )
        payload = {
            "employee_id": document.employee_id,
            "requirement_id": requirement.id,
            "company_id": document.company_id,
            "document_name": document.name or template.name or "Documento generado",
            "document_url": self._workspace_url(document.id),
            "document_origin": "template_generated",
            "template_id": template.id,
            "generated_document_id": document.id,
            "service_order_id": document.service_order_id,
            "document_number": document.output_filename or "",
            "issued_on": utc_strftime("%Y-%m-%d"),
            "expires_on": "",
            "verification_status": "pending_review",
            "verified_by": None,
            "verified_at": "",
            "notes": notes,
            "source_module": document.source_module or document.target_module or "document_center",
            "signature_request_id": document.signature_request_id,
            "signature_status": (
                "signed"
                if document.status == "signed"
                else "pending"
                if document.requires_signature
                else "not_required"
            ),
            "signed_document_url": self._workspace_url(document.id) if document.status == "signed" else "",
        }
        try:
            if existing:
                for field_name, value in payload.items():
                    setattr(existing, field_name, value)
                existing.save()
                return existing
            return EmployeeAccreditationDocument.create(payload)
        except Exception as exc:
            self.logger.warning(f"Accreditation register skipped for generated doc #{document.id}: {exc}")
            return None

    def _approve_linked_accreditation_document(self, document: GeneratedDocument) -> None:
        if not document.accreditation_document_id:
            return
        try:
            from modules.hr.module_hr import EmployeeAccreditationDocument

            accreditation_document = EmployeeAccreditationDocument.find_by_id(
                int(document.accreditation_document_id)
            )
            if not accreditation_document:
                return
            accreditation_document.document_name = document.name or accreditation_document.document_name
            accreditation_document.document_url = self._workspace_url(document.id)
            accreditation_document.document_origin = "template_generated"
            accreditation_document.template_id = document.template_id
            accreditation_document.generated_document_id = document.id
            accreditation_document.service_order_id = document.service_order_id
            accreditation_document.document_number = document.output_filename or accreditation_document.document_number
            accreditation_document.signature_request_id = document.signature_request_id
            accreditation_document.signature_status = "signed" if document.status == "signed" else "not_required"
            accreditation_document.signed_document_url = (
                self._workspace_url(document.id) if document.status == "signed" else accreditation_document.signed_document_url
            )
            accreditation_document.source_module = (
                document.source_module or document.target_module or "document_center"
            )
            accreditation_document.verification_status = "approved"
            accreditation_document.verified_by = self.env.user.id if self.env.user else None
            accreditation_document.verified_at = utc_now_iso()
            accreditation_document.notes = (
                f"Documento validado desde flujo documental {document.source_module or document.target_module or 'document_center'}."
            )
            accreditation_document.save()
        except Exception as exc:
            self.logger.warning(
                f"Accreditation approval sync skipped for generated doc #{document.id}: {exc}"
            )

    def _build_worker_context_row(
        self, data: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
        try:
            from modules.hr.module_hr import EmployeeProfile
        except Exception as exc:
            raise ValidationError(f"HR module is required to generate worker documents: {exc}")

        employee_id = _safe_int(data.get("employee_id"), None)
        employee = EmployeeProfile.find_by_id(employee_id) if employee_id else None
        if not employee or (
            self.env.user.role != "superadmin" and employee.company_id != self._company_id()
        ):
            raise ValidationError("Employee not found")

        lead = self._lead_record(_safe_int(data.get("lead_id"), None))
        folder = self._safety_folder_record(_safe_int(data.get("safety_folder_id"), None))
        if folder and not lead:
            lead = self._lead_record(folder.lead_id)
        customer_id = _safe_int(data.get("customer_id"), None) or (lead.customer_id if lead else None)
        customer = self._customer_record(customer_id)
        contract = self._active_contract_for_employee(employee.id)
        payroll_profile = self._payroll_profile_for_employee(employee.id)
        company = self._company_payload()
        extra_context = self._parse_extra_context(data.get("extra_context"))
        detail_items = _normalize_str_list(
            data.get("detail_items") or data.get("items") or data.get("epp_items")
        )
        document_date = str(
            data.get("document_date")
            or data.get("issued_on")
            or data.get("delivery_date")
            or utc_strftime("%Y-%m-%d")
        )
        effective_date = str(data.get("effective_date") or document_date)
        service_type_id = (
            _safe_int(data.get("service_type_id"), None)
            or (lead.service_type_id if lead else None)
        )
        service_type_name = self._service_type_name(service_type_id)

        customer_payload = {
            "id": customer.id,
            "name": customer.name or "",
            "tax_id": getattr(customer, "tax_id", "") or "",
            "email": getattr(customer, "email", "") or "",
            "phone": getattr(customer, "phone", "") or "",
            "contact_name": getattr(customer, "contact_name", "") or "",
            "address": getattr(customer, "address", "") or "",
            "city": getattr(customer, "city", "") or "",
        } if customer else {}

        lead_payload = lead.to_dict(include_relations=True) if lead else {}
        if service_type_name and not lead_payload.get("service_type_name"):
            lead_payload["service_type_name"] = service_type_name
        folder_payload = folder.to_dict() if folder else {}
        employee_payload = employee.to_dict()
        contract_payload = contract.to_dict() if contract else {}
        payroll_payload = payroll_profile.to_dict() if payroll_profile else {}

        row: Dict[str, Any] = {}
        for prefix, payload in (
            ("employee", employee_payload),
            ("contract", contract_payload),
            ("payroll", payroll_payload),
            ("customer", customer_payload),
            ("lead", lead_payload),
            ("folder", folder_payload),
            ("company", company),
        ):
            _flatten_context(prefix, payload, row)

        note_text = str(data.get("notes") or data.get("observaciones") or "").strip()
        item_line = ", ".join(detail_items)
        item_block = "\n".join(detail_items)

        row.update(
            {
                "employee_id": employee.id,
                "customer_id": customer_id,
                "service_order_id": _safe_int(data.get("service_order_id"), None),
                "requirement_code": _slugify_code(data.get("requirement_code") or ""),
                "service_type_id": service_type_id,
                "nombre": employee.full_name or "",
                "nombre_completo": employee.full_name or "",
                "trabajador": employee.full_name or "",
                "employee_name": employee.full_name or "",
                "full_name": employee.full_name or "",
                "email": employee.work_email or employee.personal_email or "",
                "employee_email": employee.work_email or employee.personal_email or "",
                "rut": payroll_payload.get("national_id") or "",
                "employee_rut": payroll_payload.get("national_id") or "",
                "national_id": payroll_payload.get("national_id") or "",
                "employee_code": employee.employee_code or "",
                "cargo": employee.position_title or "",
                "position_title": employee.position_title or "",
                "direccion": employee.address or "",
                "domicilio": employee.address or "",
                "comuna": employee.commune or "",
                "ciudad": employee.city or "",
                "pais": employee.nationality or "",
                "nacionalidad": employee.nationality or "",
                "situacion_civil": employee.marital_status or "",
                "estado_civil": employee.marital_status or "",
                "fecha_nacimiento": str(employee.birth_date or ""),
                "fecha_de_nacimiento": str(employee.birth_date or ""),
                "cliente": customer_payload.get("name") or lead_payload.get("customer_name") or "",
                "customer_name": customer_payload.get("name") or lead_payload.get("customer_name") or "",
                "customer_tax_id": customer_payload.get("tax_id") or "",
                "company_name": company.get("name") or "",
                "company_legal_name": company.get("legal_name") or "",
                "company_tax_id": company.get("tax_id") or "",
                "oportunidad": lead_payload.get("title") or "",
                "lead_title": lead_payload.get("title") or "",
                "project_code": lead_payload.get("project_code") or folder_payload.get("project_code") or "",
                "service_type_name": service_type_name or lead_payload.get("service_type_name") or "",
                "document_date": document_date,
                "issued_on": document_date,
                "effective_date": effective_date,
                "delivery_date": str(data.get("delivery_date") or document_date),
                "detail_items": item_line,
                "detail_items_multiline": item_block,
                "items": item_line,
                "items_multiline": item_block,
                "epp_items": item_line,
                "epp_items_multiline": item_block,
                "notes": note_text,
                "observaciones": note_text,
                "target_record_id": _safe_int(data.get("target_record_id"), None)
                or (folder.id if folder else None)
                or (lead.id if lead else None),
                "row_key": payroll_payload.get("national_id")
                or employee.employee_code
                or str(employee.id),
                "source_module": data.get("source_module")
                or ("safety" if folder else "document_center"),
                "source_record_id": _safe_int(data.get("source_record_id"), None),
                "source_label": data.get("source_label")
                or folder_payload.get("project_code")
                or lead_payload.get("title")
                or employee.full_name
                or "",
                "safety_folder_id": folder.id if folder else None,
                "lead_id": lead.id if lead else None,
            }
        )

        for key, value in extra_context.items():
            if not str(key).strip():
                continue
            row[str(key).strip()] = _merge_scalar(value)

        row_context = {
            "recipient_email": row.get("email") or "",
            "recipient_name": row.get("nombre") or employee.full_name or "",
            "row_key": row.get("row_key") or "",
            "employee_id": employee.id,
            "customer_id": customer_id,
            "service_type_id": service_type_id,
            "target_record_id": row.get("target_record_id"),
        }
        context_meta = {
            "source_module": row.get("source_module") or "document_center",
            "source_record_id": row.get("source_record_id"),
            "source_label": row.get("source_label") or "",
            "lead_id": lead.id if lead else None,
            "safety_folder_id": folder.id if folder else None,
            "customer_id": customer_id,
            "service_order_id": _safe_int(data.get("service_order_id"), None),
            "requirement_code": _slugify_code(data.get("requirement_code") or ""),
            "service_type_id": service_type_id,
            "default_target_module": data.get("target_module")
            or ("safety" if folder else ("crm" if lead else "hr")),
            "default_target_record_id": row.get("target_record_id"),
        }
        return row, row_context, context_meta

    def _refresh_signature_state(self, document: GeneratedDocument) -> None:
        if not document.signature_request_id:
            if document.requires_signature and not (document.pdf_layout or []):
                document._refresh_pdf_signature_layout()
            return
        document._refresh_pdf_signature_layout()
        try:
            from modules.signature.module_signature import SignatureRequest

            signature_request = SignatureRequest.find_by_id(int(document.signature_request_id))
            if not signature_request:
                return
            if signature_request.status == "signed":
                if signature_request.signed_document:
                    document.pdf_data = signature_request.signed_document
                elif signature_request.document_data:
                    document.pdf_data = signature_request.document_data
                document.signature_positions = signature_request.signature_positions or document.signature_positions or []
                document.signature_layout_confirmed = bool(signature_request.layout_confirmed)
                document.status = "signed" if document.status != "closed" else document.status
                document.signed_at = _fmt_dt(signature_request.signed_at) or document.signed_at
                document._refresh_pdf_signature_layout()
                document.save()
                if document.accreditation_document_id:
                    try:
                        from modules.hr.module_hr import EmployeeAccreditationDocument

                        accreditation_document = EmployeeAccreditationDocument.find_by_id(
                            int(document.accreditation_document_id)
                        )
                        if accreditation_document:
                            accreditation_document.signature_request_id = document.signature_request_id
                            accreditation_document.signature_status = "signed"
                            accreditation_document.signed_document_url = self._workspace_url(document.id)
                            accreditation_document.save()
                    except Exception as sync_exc:
                        self.logger.warning(
                            f"Accreditation signature sync skipped for doc #{document.id}: {sync_exc}"
                        )
                if (document.source_module or "") == "accreditation" and document.source_record_id:
                    try:
                        from modules.accreditation.models import DocumentGenerationRequest

                        gen_request = DocumentGenerationRequest.find_by_id(
                            int(document.source_record_id)
                        )
                        if gen_request:
                            gen_request.status = "signed"
                            gen_request.generated_document_id = document.id
                            gen_request.signature_request_id = document.signature_request_id
                            gen_request.accreditation_document_id = document.accreditation_document_id
                            gen_request.save()
                    except Exception as gen_exc:
                        self.logger.warning(
                            f"Accreditation generation request sync skipped for doc #{document.id}: {gen_exc}"
                        )
            elif signature_request.status in ("sent", "viewed") and document.status not in ("signed", "closed"):
                document.signature_positions = signature_request.signature_positions or document.signature_positions or []
                document.signature_layout_confirmed = bool(signature_request.layout_confirmed)
                document.status = "signature_pending"
                document.save()
            elif signature_request.status in ("declined", "expired") and document.status not in ("signed", "closed"):
                document.status = "error"
                document.last_error = f"Signature request is {signature_request.status}"
                document.save()
        except Exception as exc:
            self.logger.warning(f"Signature sync skipped: {exc}")

    def _signature_summary(self, document: GeneratedDocument) -> Optional[Dict[str, Any]]:
        if not document.signature_request_id:
            return None
        try:
            from modules.signature.module_signature import SignatureRequest

            signature_request = SignatureRequest.find_by_id(int(document.signature_request_id))
            if not signature_request:
                return None
            return {
                "id": signature_request.id,
                "status": signature_request.status,
                "public_url": (
                    f"/app/sign/{signature_request.signer_public_token()}"
                    if signature_request.signer_public_token()
                    else None
                ),
                "request_to_email": signature_request.request_to_email,
                "signers": [signer.to_dict() for signer in signature_request.get_signers()],
                "signed_at": _fmt_dt(signature_request.signed_at),
                "signed_document_hash": signature_request.signed_document_hash,
                "digital_key_fingerprint": signature_request.digital_key_fingerprint,
                "delivery_status": signature_request.delivery_status or {},
            }
        except Exception as exc:
            self.logger.warning(f"Signature summary skipped: {exc}")
            return None

    async def get_stats(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        templates = DocumentTemplate.search(self._tenant_filter())
        generated = GeneratedDocument.search(self._tenant_filter())
        batches = DocumentBatch.search(self._tenant_filter())
        for item in generated:
            self._refresh_signature_state(item)

        return Response.ok(
            {
                "templates_total": len(templates),
                "templates_active": len([item for item in templates if item.status == "active"]),
                "batches_total": len(batches),
                "documents_total": len(generated),
                "documents_ready_for_review": len(
                    [item for item in generated if item.status == "ready_for_review"]
                ),
                "documents_signature_pending": len(
                    [item for item in generated if item.status == "signature_pending"]
                ),
                "documents_signed": len([item for item in generated if item.status == "signed"]),
                "documents_closed": len([item for item in generated if item.status == "closed"]),
            }
        )

    async def list_templates(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        status = request.get_param("status")
        target_module = request.get_param("target_module")
        scope_type = request.get_param("scope_type")
        subject_type = request.get_param("subject_type")
        customer_id = _safe_int(request.get_param("customer_id"), None)
        service_order_id = _safe_int(request.get_param("service_order_id"), None)
        requirement_code = request.get_param("requirement_code")
        if (target_module or "").strip().lower() == "safety":
            self._ensure_safety_epp_template()
        templates = DocumentTemplate.search(self._tenant_filter())
        if status:
            templates = [item for item in templates if (item.status or "") == status]
        if target_module:
            templates = [item for item in templates if (item.target_module or "") == target_module]
        if scope_type:
            templates = [item for item in templates if (item.scope_type or "") == scope_type]
        if subject_type:
            templates = [item for item in templates if (item.subject_type or "") == subject_type]
        if customer_id:
            templates = [
                item
                for item in templates
                if not item.customer_id or item.customer_id == customer_id
            ]
        if service_order_id:
            templates = [
                item
                for item in templates
                if not item.service_order_id or item.service_order_id == service_order_id
            ]
        if requirement_code:
            normalized_code = _slugify_code(requirement_code)
            templates = [
                item
                for item in templates
                if _slugify_code(item.accreditation_requirement_code or item.name or "") == normalized_code
            ]
        templates.sort(key=lambda item: ((item.name or "").lower(), item.id or 0))
        return Response.ok({"count": len(templates), "results": [item.to_dict() for item in templates]})

    async def create_template(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        try:
            template_bytes = _b64decode(data.get("template_data") or "")
            source_format = _format_from_upload(
                data.get("original_filename") or "template.docx",
                data.get("template_mime") or "",
            )
            template = DocumentTemplate.create(
                {
                    "name": data.get("name"),
                    "description": data.get("description"),
                    "category": data.get("category") or "general",
                    "document_type": data.get("document_type") or "general",
                    "target_module": data.get("target_module") or "general",
                    "scope_type": data.get("scope_type") or "general_empresa",
                    "subject_type": data.get("subject_type") or "trabajador",
                    "status": data.get("status") or "active",
                    "company_id": self._company_id(),
                    "customer_id": _safe_int(data.get("customer_id"), None),
                    "service_order_id": _safe_int(data.get("service_order_id"), None),
                    "service_type_id": _safe_int(data.get("service_type_id"), None),
                    "requires_signature": _normalize_bool(data.get("requires_signature"), False),
                    "auto_register_accreditation": _normalize_bool(
                        data.get("auto_register_accreditation"), False
                    ),
                    "accreditation_requirement_code": data.get("accreditation_requirement_code")
                    or "",
                    "accreditation_category": data.get("accreditation_category") or "other",
                    "filename_pattern": data.get("filename_pattern") or data.get("name"),
                    "original_filename": data.get("original_filename") or f"template.{source_format}",
                    "template_mime": data.get("template_mime") or _mime_for_format(source_format),
                    "source_format": source_format,
                    "original_template_data": data.get("template_data"),
                    "original_file_hash": _hash_bytes(template_bytes),
                    "original_file_size": len(template_bytes),
                    "conversion_status": "pending",
                    "conversion_error": "",
                    "available_formats": ["source"],
                    "template_data": data.get("template_data"),
                    "signature_layout": data.get("signature_layout") or [],
                    "signature_roles": _normalize_signature_roles(data.get("signature_roles") or []),
                    "signature_layout_confirmed": _normalize_bool(
                        data.get("signature_layout_confirmed"), False
                    ),
                    "placeholder_keys": [],
                    "placeholder_validation_status": "pending",
                    "invalid_placeholders": [],
                    "preview_text": "",
                    "tags": data.get("tags") or [],
                }
            )
            self._refresh_template_preview_metadata(
                template,
                template_bytes=template_bytes,
            )
            template.save()
            return Response.created(template.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        except Exception as exc:
            template = locals().get("template")
            if template:
                template.conversion_status = "failed"
                template.conversion_error = str(exc)
                template.status = "draft"
                template.available_formats = ["source"]
                template.save()
                return Response.created(
                    {
                        **template.to_dict(),
                        "warning": (
                            "Template was preserved as draft, but conversion failed. "
                            f"{exc}"
                        ),
                    }
                )
            return Response.bad_request(f"Could not read template file: {exc}")

    async def get_template(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        template, error = self._template_or_404(request.params.get("id"))
        if error:
            return error
        include_content = _normalize_bool(request.get_param("include_content"), False)
        return Response.ok(template.to_dict(include_content=include_content))

    async def update_template(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        template, error = self._template_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        refresh_preview = False
        for field_name in (
            "name",
            "description",
            "category",
            "document_type",
            "target_module",
            "scope_type",
            "subject_type",
            "status",
            "filename_pattern",
            "original_filename",
            "template_mime",
        ):
            if field_name in data:
                setattr(template, field_name, data.get(field_name))
                if field_name in ("name", "scope_type", "subject_type"):
                    refresh_preview = True
        if "customer_id" in data:
            template.customer_id = _safe_int(data.get("customer_id"), None)
        if "service_order_id" in data:
            template.service_order_id = _safe_int(data.get("service_order_id"), None)
        if "service_type_id" in data:
            template.service_type_id = _safe_int(data.get("service_type_id"), None)
        if "requires_signature" in data:
            template.requires_signature = _normalize_bool(data.get("requires_signature"), False)
            refresh_preview = True
        if "signature_layout" in data:
            template.signature_layout = data.get("signature_layout") or []
        if "signature_roles" in data:
            template.signature_roles = _normalize_signature_roles(data.get("signature_roles") or [])
        if "signature_layout_confirmed" in data:
            template.signature_layout_confirmed = _normalize_bool(
                data.get("signature_layout_confirmed"), False
            )
        if "auto_register_accreditation" in data:
            template.auto_register_accreditation = _normalize_bool(
                data.get("auto_register_accreditation"), False
            )
        if "accreditation_requirement_code" in data:
            template.accreditation_requirement_code = (
                data.get("accreditation_requirement_code") or ""
            )
        if "accreditation_category" in data:
            template.accreditation_category = data.get("accreditation_category") or "other"
        if "tags" in data:
            template.tags = data.get("tags") or []

        if data.get("template_data"):
            try:
                template_bytes = _b64decode(data.get("template_data"))
                source_format = _format_from_upload(
                    data.get("original_filename") or template.original_filename or "",
                    data.get("template_mime") or template.template_mime or "",
                )
                template.source_format = source_format
                template.original_template_data = data.get("template_data")
                template.original_file_hash = _hash_bytes(template_bytes)
                template.original_file_size = len(template_bytes)
                template.available_formats = ["source"]
                template.conversion_status = "pending"
                template.conversion_error = ""
                template.template_data = data.get("template_data")
                self._refresh_template_preview_metadata(
                    template,
                    template_bytes=template_bytes,
                )
            except Exception as exc:
                template.conversion_status = "failed"
                template.conversion_error = str(exc)
                template.status = "draft"
                template.available_formats = ["source"]
                template.save()
                return Response.bad_request(
                    "Template file was preserved as draft, but conversion failed: "
                    f"{exc}"
                )
        elif refresh_preview:
            try:
                self._refresh_template_preview_metadata(template)
            except Exception as exc:
                return Response.bad_request(f"Could not refresh template preview: {exc}")

        try:
            template.save()
            return Response.ok(template.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_template(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        template, error = self._template_or_404(request.params.get("id"))
        if error:
            return error

        generated = GeneratedDocument.search([("template_id", "=", template.id)])
        if generated:
            return Response.bad_request("Cannot delete a template that already generated documents")
        template.delete()
        return Response.ok({"message": "Template deleted"})

    async def get_template_preview_pdf(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        template, error = self._template_or_404(request.params.get("id"))
        if error:
            return error

        if not template.template_pdf_data:
            try:
                self._refresh_template_preview_metadata(template)
                template.save()
            except Exception as exc:
                return Response.bad_request(f"Could not build template PDF preview: {exc}")

        return Response.ok(
            {
                "id": template.id,
                "file_name": f"{_slugify(template.name or 'plantilla')}_preview.pdf",
                "mime_type": PDF_MIME,
                "pdf_data": template.template_pdf_data or "",
                "pdf_layout": template.template_pdf_layout or [],
                "signature_layout": template.signature_layout or [],
                "signature_roles": template.signature_roles or [],
                "signature_layout_confirmed": bool(template.signature_layout_confirmed),
                "placeholder_keys": template.placeholder_keys or [],
                "placeholder_validation_status": template.placeholder_validation_status or "pending",
                "invalid_placeholders": template.invalid_placeholders or [],
            }
        )

    async def update_template_signature_layout(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        template, error = self._template_or_404(request.params.get("id"))
        if error:
            return error
        if not template.requires_signature:
            return Response.bad_request("This template does not require signatures")

        if not template.template_pdf_data or not template.template_pdf_layout:
            try:
                self._refresh_template_preview_metadata(template)
            except Exception as exc:
                return Response.bad_request(f"Could not build template PDF preview: {exc}")

        template.signature_roles = _normalize_signature_roles(
            request.get_data("signature_roles") or template.signature_roles or []
        )
        template.signature_layout = normalize_signature_positions(
            request.get_data("signature_layout") or request.get_data("signature_positions") or template.signature_layout or [],
            template.template_pdf_layout or [],
        )
        if not template.signature_layout:
            return Response.bad_request("At least one signature box is required")
        template.signature_layout_confirmed = True
        try:
            template.save()
            return Response.ok(
                {
                    "id": template.id,
                    "signature_layout": template.signature_layout or [],
                    "signature_roles": template.signature_roles or [],
                    "template_pdf_layout": template.template_pdf_layout or [],
                    "signature_layout_confirmed": bool(template.signature_layout_confirmed),
                }
            )
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_lookups(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        target_module = (request.get_param("target_module") or "").strip().lower()
        customer_id = _safe_int(request.get_param("customer_id"), None)

        if target_module == "safety":
            self._ensure_safety_epp_template()
        templates = DocumentTemplate.search(self._tenant_filter())
        templates = [item for item in templates if (item.status or "") == "active"]
        if target_module:
            templates = [
                item
                for item in templates
                if (item.target_module or "") in ("general", target_module)
            ]
        templates.sort(key=lambda item: ((item.name or "").lower(), item.id or 0))

        employees: List[Dict[str, Any]] = []
        try:
            from modules.hr.module_hr import EmployeeProfile

            employee_records = EmployeeProfile.search([("company_id", "=", self._company_id())])
            employee_records = [
                item for item in employee_records if (item.status or "") in ("active", "onboarding")
            ]
            employee_records.sort(key=lambda item: ((item.full_name or "").lower(), item.id or 0))
            employees = [item.to_dict() for item in employee_records]
        except Exception:
            employees = []

        customers: List[Dict[str, Any]] = []
        leads: List[Dict[str, Any]] = []
        try:
            from modules.crm.module_crm import Customer, Lead

            customer_records = Customer.search([("company_id", "=", self._company_id())])
            customer_records.sort(key=lambda item: ((item.name or "").lower(), item.id or 0))
            customers = [
                {
                    "id": item.id,
                    "name": item.name or "",
                    "tax_id": getattr(item, "tax_id", "") or "",
                    "contact_name": getattr(item, "contact_name", "") or "",
                    "email": getattr(item, "email", "") or "",
                }
                for item in customer_records
            ]

            lead_records = Lead.search([("company_id", "=", self._company_id())])
            lead_records = [item for item in lead_records if (item.status or "") != "lost"]
            if customer_id:
                lead_records = [item for item in lead_records if item.customer_id == customer_id]
            lead_records.sort(key=lambda item: ((item.project_code or "").lower(), item.id or 0), reverse=True)
            leads = [item.to_dict(include_relations=True) for item in lead_records]
        except Exception:
            customers = customers or []
            leads = []

        safety_folders: List[Dict[str, Any]] = []
        try:
            from modules.safety.module_safety import SafetyFolder

            folder_records = SafetyFolder.search([("company_id", "=", self._company_id())])
            folder_payloads = [item.to_dict() for item in folder_records]
            if customer_id:
                folder_payloads = [
                    item for item in folder_payloads if _safe_int(item.get("customer_id"), None) == customer_id
                ]
            folder_payloads.sort(
                key=lambda item: (
                    str(item.get("project_code") or ""),
                    _safe_int(item.get("id"), 0) or 0,
                ),
                reverse=True,
            )
            safety_folders = folder_payloads
        except Exception:
            safety_folders = []

        return Response.ok(
            {
                "templates": [item.to_dict() for item in templates],
                "employees": employees,
                "customers": customers,
                "leads": leads,
                "safety_folders": safety_folders,
            }
        )

    def _generate_batch_core(
        self,
        template: DocumentTemplate,
        rows: List[Dict[str, Any]],
        data: Dict[str, Any],
        request: Optional[Request],
        source_type: str,
        source_meta: Dict[str, Any],
    ) -> Dict[str, Any]:
        mapping = data.get("mapping") or _auto_mapping(
            template.placeholder_keys or [], _preview_rows(rows)["columns"]
        )
        batch_name = data.get("batch_name") or f"{template.name} {utc_strftime('%Y-%m-%d %H:%M')}"
        batch = DocumentBatch.create(
            {
                "name": batch_name,
                "template_id": template.id,
                "company_id": self._company_id(),
                "status": "processing",
                "source_type": source_type,
                "source_name": data.get("source_name") or batch_name,
                "source_url": source_meta.get("source_url") or data.get("source_url"),
                "source_columns": _preview_rows(rows)["columns"],
                "mapping": mapping,
                "rows_processed": len(rows),
                "rows_succeeded": 0,
                "rows_failed": 0,
                "target_module": data.get("target_module") or template.target_module or "general",
                "target_record_id": _safe_int(data.get("target_record_id"), None),
                "customer_id": _safe_int(data.get("customer_id"), None),
                "service_type_id": _safe_int(data.get("service_type_id"), None),
                "created_by": self.env.user.id if self.env.user else None,
                "notes": data.get("notes"),
            }
        )

        successes = 0
        failures = 0
        generated_ids: List[int] = []
        generated_payloads: List[Dict[str, Any]] = []
        template_bytes = _b64decode(template.template_data)

        for row_index, row in enumerate(rows, start=1):
            try:
                merge_data = _build_merge_data(row, mapping, template, row_index, batch_name)
                row_context = _derive_row_context(row, data)
                merged_docx, preview_text = _merge_docx(template_bytes, merge_data)
                title = _replace_placeholders(template.filename_pattern or template.name, merge_data)
                extra_lines = [
                    f"Template: {template.name}",
                    f"Lote: {batch_name}",
                    f"Fila: {row_index}",
                ]
                pdf_bytes = _build_pdf(title, merged_docx, preview_text, extra_lines=extra_lines)
                subject_type_value = template.subject_type or "trabajador"
                if subject_type_value == "trabajador":
                    subject_id_value = row_context["employee_id"]
                elif subject_type_value == "cliente":
                    subject_id_value = row_context["customer_id"] or batch.customer_id
                elif subject_type_value == "oc":
                    subject_id_value = row_context["target_record_id"] or batch.target_record_id
                elif subject_type_value == "empresa":
                    subject_id_value = self._company_id()
                else:
                    subject_id_value = row_context["employee_id"]
                generated = GeneratedDocument.create(
                    {
                        "batch_id": batch.id,
                        "template_id": template.id,
                        "company_id": self._company_id(),
                        "name": title,
                        "output_filename": _slugify(title or f"{template.name}_{row_index}"),
                        "row_index": row_index,
                        "row_key": row_context["row_key"],
                        "recipient_name": row_context["recipient_name"],
                        "recipient_email": row_context["recipient_email"],
                        "employee_id": row_context["employee_id"],
                        "customer_id": row_context["customer_id"] or batch.customer_id,
                        "service_order_id": _safe_int(
                            data.get("service_order_id") or row.get("service_order_id"), None
                        ),
                        "service_type_id": row_context["service_type_id"] or batch.service_type_id,
                        "subject_type": subject_type_value,
                        "subject_id": subject_id_value,
                        "template_scope_type": template.scope_type or "general_empresa",
                        "source_module": str(
                            data.get("source_module") or row.get("source_module") or "document_center"
                        ).strip()
                        or "document_center",
                        "source_record_id": _safe_int(
                            data.get("source_record_id") or row.get("source_record_id"), None
                        ),
                        "source_label": str(
                            data.get("source_label") or row.get("source_label") or ""
                        ).strip(),
                        "target_module": batch.target_module,
                        "target_record_id": row_context["target_record_id"] or batch.target_record_id,
                        "merge_payload": merge_data,
                        "docx_data": _b64encode(merged_docx),
                        "pdf_data": _b64encode(pdf_bytes),
                        "preview_text": preview_text,
                        "template_signature_layout_snapshot": template.signature_layout or [],
                        "signature_roles_snapshot": _normalize_signature_roles(
                            template.signature_roles or [],
                            default_email=row_context["recipient_email"],
                            default_name=row_context["recipient_name"],
                        ),
                        "signature_positions": template.signature_layout or [],
                        "signature_layout_confirmed": bool(
                            template.signature_layout_confirmed or not template.requires_signature
                        ),
                        "status": "ready_for_review",
                        "requires_signature": template.requires_signature
                        if data.get("requires_signature_override") in (None, "")
                        else _normalize_bool(data.get("requires_signature_override"), template.requires_signature),
                        "tags": template.tags or [],
                    }
                )
                accreditation_document = self._register_generated_in_accreditation(generated, template)
                if accreditation_document:
                    generated.accreditation_document_id = accreditation_document.id
                    generated.save()
                self._log_event(
                    generated,
                    "generated",
                    request,
                    notes=f"Generated from batch {batch.name}",
                    metadata={
                        "source_module": generated.source_module,
                        "source_record_id": generated.source_record_id,
                        "target_module": generated.target_module,
                        "target_record_id": generated.target_record_id,
                    },
                )
                successes += 1
                generated_ids.append(generated.id)
                generated_payloads.append(generated.to_dict())
            except Exception as exc:
                failures += 1
                self.logger.warning(f"Document generation failed on row {row_index}: {exc}")

        batch.rows_succeeded = successes
        batch.rows_failed = failures
        batch.status = "completed" if failures == 0 else "completed_with_errors"
        if successes == 0:
            batch.status = "error"
        batch.save()

        return {
            "batch": batch.to_dict(),
            "generated_document_ids": generated_ids,
            "generated_documents": generated_payloads,
            "summary": {
                "rows_processed": len(rows),
                "rows_succeeded": successes,
                "rows_failed": failures,
            },
        }

    def generate_worker_documents_internal(
        self, data: Dict[str, Any], request: Optional[Request] = None
    ) -> Dict[str, Any]:
        template_ids = data.get("template_ids") or []
        if isinstance(template_ids, str):
            template_ids = [item.strip() for item in template_ids.split(",") if item.strip()]
        template_ids = [_safe_int(item, None) for item in template_ids if _safe_int(item, None)]
        if not template_ids and data.get("requirement_code"):
            requirement_code = _slugify_code(data.get("requirement_code"))
            candidates = [
                item
                for item in DocumentTemplate.search(self._tenant_filter())
                if (item.status or "") == "active"
                and _slugify_code(
                    item.accreditation_requirement_code
                    or item.document_type
                    or item.name
                    or ""
                )
                == requirement_code
            ]
            template_ids = [item.id for item in candidates if item.id]
        if not template_ids:
            raise ValidationError("Select at least one template")

        row, _, context_meta = self._build_worker_context_row(data)

        results: List[Dict[str, Any]] = []
        generated_documents: List[Dict[str, Any]] = []
        total_generated = 0
        total_accreditation = 0

        for template_id in template_ids:
            template, error = self._template_or_404(template_id)
            if error:
                raise ValidationError(error.errors[0] if error.errors else "Template not found")
            payload = {
                **data,
                "batch_name": data.get("batch_name")
                or f"{template.name} - {row.get('nombre') or row.get('employee_name') or row.get('employee_id')}",
                "mapping": {placeholder: placeholder for placeholder in (template.placeholder_keys or [])},
                "recipient_email_column": "email",
                "recipient_name_column": "nombre",
                "employee_id_column": "employee_id",
                "customer_id_column": "customer_id",
                "service_type_id_column": "service_type_id",
                "row_key_column": "row_key",
                "target_record_id_column": "target_record_id",
                "source_module": data.get("source_module") or context_meta["source_module"],
                "source_record_id": data.get("source_record_id") or context_meta["source_record_id"],
                "source_label": data.get("source_label") or context_meta["source_label"],
                "target_module": data.get("target_module") or context_meta["default_target_module"] or template.target_module,
                "target_record_id": data.get("target_record_id") or context_meta["default_target_record_id"],
                "customer_id": data.get("customer_id") or context_meta["customer_id"],
                "service_type_id": data.get("service_type_id") or context_meta["service_type_id"],
            }
            batch_result = self._generate_batch_core(
                template,
                [row],
                payload,
                request,
                "manual_json",
                {"row_count": 1, "source_type": "manual_json"},
            )
            results.append(batch_result)
            generated_documents.extend(batch_result["generated_documents"])
            total_generated += batch_result["summary"]["rows_succeeded"]
            total_accreditation += len(
                [item for item in batch_result["generated_documents"] if item.get("accreditation_document_id")]
            )

        if not total_generated:
            raise ValidationError("No documents could be generated")
        return {
            "results": results,
            "generated_documents": generated_documents,
            "summary": {
                "templates_requested": len(template_ids),
                "documents_generated": total_generated,
                "accreditation_registered": total_accreditation,
            },
        }

    async def generate_worker_documents(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        try:
            result = self.generate_worker_documents_internal(data, request=request)
            return Response.created(result)
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        except Exception as exc:
            return Response.bad_request(f"Could not generate worker documents: {exc}")

    async def preview_data_source(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        source_type = data.get("source_type")
        if source_type not in DATA_SOURCE_TYPES:
            return Response.bad_request("Invalid source type")

        try:
            rows, source_meta = _load_rows_from_source(source_type, data)
            preview = _preview_rows(rows)
            placeholders = []
            if data.get("template_id"):
                template, error = self._template_or_404(data.get("template_id"))
                if error:
                    return error
                placeholders = template.placeholder_keys or []
            mapping = _auto_mapping(placeholders, preview["columns"])
            return Response.ok({**preview, "placeholders": placeholders, "mapping": mapping, "source_meta": source_meta})
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        except Exception as exc:
            return Response.bad_request(f"Could not preview data source: {exc}")

    async def list_batches(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        batches = DocumentBatch.search(self._tenant_filter())
        template_map = {
            item.id: item
            for item in DocumentTemplate.search(self._tenant_filter())
            if item.id
        }
        for batch in batches:
            batch._template_cache = template_map.get(batch.template_id)
        template_id = _safe_int(request.get_param("template_id"), None)
        if template_id:
            batches = [item for item in batches if item.template_id == template_id]
        batches.sort(key=lambda item: (item.id or 0), reverse=True)
        return Response.ok({"count": len(batches), "results": [item.to_dict() for item in batches]})

    async def get_batch(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        batch, error = self._batch_or_404(request.params.get("id"))
        if error:
            return error

        documents = GeneratedDocument.search([("batch_id", "=", batch.id)])
        template_map = {
            item.id: item
            for item in DocumentTemplate.search(self._tenant_filter())
            if item.id
        }
        for item in documents:
            item._template_cache = template_map.get(item.template_id)
            item._batch_cache = batch
            self._refresh_signature_state(item)
        documents.sort(key=lambda item: (item.row_index or 0, item.id or 0))
        return Response.ok(
            {
                **batch.to_dict(),
                "documents": [item.to_dict() for item in documents],
            }
        )

    async def generate_batch(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        template, error = self._template_or_404(data.get("template_id"))
        if error:
            return error

        source_type = data.get("source_type")
        if source_type not in DATA_SOURCE_TYPES:
            return Response.bad_request("Invalid source type")

        try:
            rows, source_meta = _load_rows_from_source(source_type, data)
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        except Exception as exc:
            return Response.bad_request(f"Could not read source data: {exc}")

        if not rows:
            return Response.bad_request("The selected data source does not contain rows")
        try:
            result = self._generate_batch_core(
                template,
                rows,
                data,
                request,
                source_type,
                source_meta,
            )
            return Response.created(result)
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        except Exception as exc:
            return Response.bad_request(f"Could not generate documents: {exc}")

    async def list_generated_documents(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        documents = GeneratedDocument.search(self._tenant_filter())
        template_map = {
            item.id: item
            for item in DocumentTemplate.search(self._tenant_filter())
            if item.id
        }
        batch_map = {
            item.id: item
            for item in DocumentBatch.search(self._tenant_filter())
            if item.id
        }
        status = request.get_param("status")
        target_module = request.get_param("target_module")
        template_id = _safe_int(request.get_param("template_id"), None)
        batch_id = _safe_int(request.get_param("batch_id"), None)
        employee_id = _safe_int(request.get_param("employee_id"), None)
        customer_id = _safe_int(request.get_param("customer_id"), None)
        target_record_id = _safe_int(request.get_param("target_record_id"), None)
        source_module = request.get_param("source_module")
        source_record_id = _safe_int(request.get_param("source_record_id"), None)
        search = (request.get_param("search", "") or "").strip().lower()

        if target_module:
            documents = [item for item in documents if (item.target_module or "") == target_module]
        if template_id:
            documents = [item for item in documents if item.template_id == template_id]
        if batch_id:
            documents = [item for item in documents if item.batch_id == batch_id]
        if employee_id:
            documents = [item for item in documents if item.employee_id == employee_id]
        if customer_id:
            documents = [item for item in documents if item.customer_id == customer_id]
        if target_record_id:
            documents = [item for item in documents if item.target_record_id == target_record_id]
        if source_module:
            documents = [item for item in documents if (item.source_module or "") == source_module]
        if source_record_id:
            documents = [item for item in documents if item.source_record_id == source_record_id]
        if search:
            documents = [
                item
                for item in documents
                if search in (item.name or "").lower()
                or search in (item.recipient_name or "").lower()
                or search in (item.recipient_email or "").lower()
                or search in (item.output_filename or "").lower()
            ]

        for item in documents:
            item._template_cache = template_map.get(item.template_id)
            item._batch_cache = batch_map.get(item.batch_id)
            self._refresh_signature_state(item)

        if status:
            documents = [item for item in documents if (item.status or "") == status]

        documents.sort(key=lambda item: (_fmt_dt(item._data.get("created_at")) or "", item.id or 0), reverse=True)
        return Response.ok({"count": len(documents), "results": [item.to_dict() for item in documents]})

    async def get_generated_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._generated_or_404(request.params.get("id"))
        if error:
            return error

        self._refresh_signature_state(document)
        history = DocumentEventLog.search([("document_id", "=", document.id)])
        history.sort(key=lambda item: (item.id or 0))
        self._log_event(document, "viewed", request, notes="Viewed document detail")
        return Response.ok(
            {
                **document.to_dict(),
                "pdf_data": document.pdf_data,
                "signature_request": self._signature_summary(document),
                "history": [item.to_dict() for item in history],
            }
        )

    async def update_generated_signature_layout(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._generated_or_404(request.params.get("id"))
        if error:
            return error
        if not document.requires_signature:
            return Response.bad_request("This document does not require signature")
        if not document.pdf_data:
            return Response.bad_request("The generated document does not have PDF content")
        if document.status in ("signed", "closed"):
            return Response.bad_request("Cannot update signature layout after completion")

        document._refresh_pdf_signature_layout()
        document.signature_positions = normalize_signature_positions(
            request.get_data("signature_positions", []),
            document.pdf_layout,
        )
        document.signature_roles_snapshot = _normalize_signature_roles(
            request.get_data("signature_roles") or document.signature_roles_snapshot or [],
            default_email=document.recipient_email,
            default_name=document.recipient_name,
        )
        document.signature_layout_confirmed = True
        document.save()
        if document.signature_request_id:
            try:
                from modules.signature.module_signature import SignatureRequest

                signature_request = SignatureRequest.find_by_id(int(document.signature_request_id))
                if signature_request and signature_request.status != "signed":
                    signature_request.signature_positions = document.signature_positions or []
                    signature_request.layout_confirmed = True
                    signature_request.save()
                    signature_request.sync_signers(document.signature_roles_snapshot or [])
            except Exception as exc:
                self.logger.warning(f"Signature request layout sync skipped: {exc}")
        self._log_event(
            document,
            "signature_layout_updated",
            request,
            notes=f"Updated signature layout with {len(document.signature_positions or [])} box(es)",
        )
        return Response.ok(
            {
                "id": document.id,
                "signature_positions": document.signature_positions or [],
                "signature_roles": document.signature_roles_snapshot or [],
                "pdf_layout": document.pdf_layout or [],
                "status": document.status,
            }
        )

    async def get_generated_content(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._generated_or_404(request.params.get("id"))
        if error:
            return error

        self._refresh_signature_state(document)
        fmt = (request.get_param("format") or "docx").strip().lower()
        if fmt not in ("docx", "pdf"):
            return Response.bad_request("Format must be docx or pdf")

        data_key = "docx_data" if fmt == "docx" else "pdf_data"
        mime_type = DOCX_MIME if fmt == "docx" else PDF_MIME
        data_value = getattr(document, data_key, None)
        if not data_value:
            return Response.not_found(f"{fmt.upper()} content is not available")

        self._log_event(document, f"download_{fmt}", request, notes=f"Downloaded {fmt.upper()} content")
        extension = "docx" if fmt == "docx" else "pdf"
        return Response.ok(
            {
                "id": document.id,
                "format": fmt,
                "mime_type": mime_type,
                "file_name": f"{document.output_filename}.{extension}",
                "data": data_value,
            }
        )

    async def approve_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._generated_or_404(request.params.get("id"))
        if error:
            return error

        self._refresh_signature_state(document)
        if document.status in ("closed", "signed", "signature_pending"):
            return Response.bad_request("This document is already beyond review stage")

        document.status = "approved"
        document.approved_by = self.env.user.id if self.env.user else None
        document.approved_at = utc_now_iso()
        document.last_error = ""
        document.save()
        self._log_event(document, "approved", request, notes="Document approved for release")
        return Response.ok(document.to_dict())

    async def send_document_to_signature(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._generated_or_404(request.params.get("id"))
        if error:
            return error

        self._refresh_signature_state(document)
        if not document.requires_signature:
            return Response.bad_request("This document does not require signature")
        if not document.pdf_data:
            return Response.bad_request("The generated document does not have PDF content")
        if document.signature_request_id and document.status in ("signature_pending", "signed", "closed"):
            return Response.bad_request("A signature workflow already exists for this document")
        if document.status not in ("approved", "ready_for_review"):
            return Response.bad_request("Document must be in review or approved state before sending")

        document._refresh_pdf_signature_layout()
        layout_confirmed = _normalize_bool(request.get_data("layout_confirmed"), document.signature_layout_confirmed)
        signature_positions = normalize_signature_positions(
            request.get_data("signature_positions") or document.signature_positions or default_signature_positions(document.pdf_layout),
            document.pdf_layout,
        )
        if not layout_confirmed:
            return Response.bad_request("You must confirm the signature position visually before sending this PDF")
        document.signature_positions = signature_positions
        document.signature_layout_confirmed = True
        recipient_email, recipient_name = self._resolve_signature_recipient(document)
        document.recipient_email = recipient_email
        document.recipient_name = recipient_name
        signature_roles = _normalize_signature_roles(
            document.signature_roles_snapshot or [],
            default_email=recipient_email,
            default_name=recipient_name,
        )
        for role in signature_roles:
            if not str(role.get("signer_email") or "").strip():
                role["signer_email"] = recipient_email
            if not str(role.get("signer_name") or "").strip():
                role["signer_name"] = recipient_name
        try:
            from modules.signature.module_signature import SignatureRequest

            sig_request = SignatureRequest.create(
                {
                    "name": document.name,
                    "description": f"Generated from template #{document.template_id}",
                    "request_from": self.env.user.id if self.env.user else None,
                    "request_to_email": recipient_email,
                    "document_name": f"{document.output_filename}.pdf",
                    "document_data": document.pdf_data,
                    "signature_positions": signature_positions,
                    "layout_confirmed": True,
                    "company_id": document.company_id,
                    "source_module": "document_center",
                    "source_model": "generated_document",
                    "source_record_id": document.id,
                    "generated_document_id": document.id,
                }
            )
            sig_request.sync_signers(signature_roles)
            sig_request.send_request()
            email_status = None
            signature_module = self.core.module_registry.get_module("signature")
            if signature_module and hasattr(signature_module, "_send_signature_request_email"):
                email_status = await signature_module._send_signature_request_email(sig_request, request)
                sig_request.delivery_status = {**(sig_request.delivery_status or {}), "request_email": email_status}
                sig_request.save()
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        except Exception as exc:
            return Response.bad_request(f"Could not create signature request: {exc}")

        document.signature_request_id = sig_request.id
        document.status = "signature_pending"
        document.save()
        if document.accreditation_document_id:
            try:
                from modules.hr.module_hr import EmployeeAccreditationDocument

                accreditation_document = EmployeeAccreditationDocument.find_by_id(
                    int(document.accreditation_document_id)
                )
                if accreditation_document:
                    accreditation_document.signature_request_id = sig_request.id
                    accreditation_document.document_url = self._workspace_url(document.id)
                    accreditation_document.save()
            except Exception as exc:
                self.logger.warning(f"Accreditation signature link sync skipped: {exc}")
        self._log_event(
            document,
            "signature_requested",
            request,
            notes=f"Sent to signature for {recipient_name} <{recipient_email}>",
            metadata={
                "signature_request_id": sig_request.id,
                "access_token": sig_request.access_token,
                "email_status": email_status,
            },
        )
        return Response.ok(
            {
                **document.to_dict(),
                "signature_request": {
                    "id": sig_request.id,
                    "access_token": sig_request.access_token,
                    "public_url": f"/app/sign/{sig_request.access_token}",
                    "status": sig_request.status,
                    "signature_positions": sig_request.signature_positions or [],
                    "pdf_layout": sig_request.pdf_layout or [],
                    "delivery_status": sig_request.delivery_status or {},
                },
            }
        )

    async def close_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._generated_or_404(request.params.get("id"))
        if error:
            return error

        self._refresh_signature_state(document)
        if document.requires_signature and document.status not in ("signed", "closed"):
            return Response.bad_request("Signed documents can only be closed after signature is completed")
        if not document.requires_signature and document.status not in ("approved", "closed", "signed"):
            return Response.bad_request("Document must be approved before closing")

        document.status = "closed"
        document.closed_by = self.env.user.id if self.env.user else None
        document.closed_at = utc_now_iso()
        document.save()
        self._approve_linked_accreditation_document(document)
        self._log_event(document, "closed", request, notes="Document closed in its destination context")
        return Response.ok(document.to_dict())

    async def get_document_history(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._generated_or_404(request.params.get("id"))
        if error:
            return error

        history = DocumentEventLog.search([("document_id", "=", document.id)])
        history.sort(key=lambda item: (item.id or 0))
        return Response.ok({"count": len(history), "results": [item.to_dict() for item in history]})
