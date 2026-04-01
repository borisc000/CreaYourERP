from __future__ import annotations

import base64
import hashlib
import io
import json
from typing import Any, Dict, List, Optional

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as reportlab_canvas

try:
    from pypdf import PdfReader, PdfWriter
except Exception:  # pragma: no cover
    PdfReader = None
    PdfWriter = None


DEFAULT_PDF_LAYOUT = [{"page": 0, "width": 595.28, "height": 841.89, "rotation": 0}]
DEFAULT_SIGNATURE_BOX = {"page": 0, "x_ratio": 0.58, "y_ratio": 0.76, "width_ratio": 0.28, "height_ratio": 0.1}


def strip_data_url(value: Any) -> str:
    text = str(value or "").strip()
    if text.startswith("data:") and "," in text:
        return text.split(",", 1)[1]
    return text


def b64encode_bytes(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def b64decode_bytes(value: Any) -> bytes:
    cleaned = strip_data_url(value)
    if not cleaned:
        return b""
    return base64.b64decode(cleaned.encode("ascii"))


def sha256_hex(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def short_hash(value: str, length: int = 12) -> str:
    return str(value or "")[:length]


def extract_pdf_layout(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    if not pdf_bytes or PdfReader is None:
        return [dict(item) for item in DEFAULT_PDF_LAYOUT]
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages: List[Dict[str, Any]] = []
    for index, page in enumerate(reader.pages):
        pages.append(
            {
                "page": index,
                "width": round(float(page.mediabox.width), 2),
                "height": round(float(page.mediabox.height), 2),
                "rotation": int(page.get("/Rotate", 0) or 0),
            }
        )
    return pages or [dict(item) for item in DEFAULT_PDF_LAYOUT]


def normalize_signature_positions(raw_positions: Any, pdf_layout: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    layout = pdf_layout or [dict(item) for item in DEFAULT_PDF_LAYOUT]
    if not isinstance(raw_positions, list):
        raw_positions = []
    items: List[Dict[str, Any]] = []
    for index, raw in enumerate(raw_positions, start=1):
        if not isinstance(raw, dict):
            continue
        page = int(raw.get("page", 0) or 0)
        if page < 0 or page >= len(layout):
            page = 0
        page_meta = layout[page]
        page_width = safe_float(page_meta.get("width"), 595.28)
        page_height = safe_float(page_meta.get("height"), 841.89)
        x_ratio = raw.get("x_ratio")
        y_ratio = raw.get("y_ratio")
        width_ratio = raw.get("width_ratio")
        height_ratio = raw.get("height_ratio")
        if x_ratio is None:
            x_ratio = safe_float(raw.get("x")) / page_width if page_width else 0.0
        if y_ratio is None:
            y_ratio = safe_float(raw.get("y")) / page_height if page_height else 0.0
        if width_ratio is None:
            width_ratio = safe_float(raw.get("width"), 160.0) / page_width if page_width else 0.28
        if height_ratio is None:
            height_ratio = safe_float(raw.get("height"), 60.0) / page_height if page_height else 0.1
        x_ratio = clamp(safe_float(x_ratio), 0.0, 0.98)
        y_ratio = clamp(safe_float(y_ratio), 0.0, 0.98)
        width_ratio = clamp(safe_float(width_ratio, 0.28), 0.08, 0.9)
        height_ratio = clamp(safe_float(height_ratio, 0.1), 0.04, 0.4)
        if x_ratio + width_ratio > 0.98:
            x_ratio = max(0.0, 0.98 - width_ratio)
        if y_ratio + height_ratio > 0.98:
            y_ratio = max(0.0, 0.98 - height_ratio)
        items.append(
            {
                "id": str(raw.get("id") or f"sig-{index}"),
                "label": str(raw.get("label") or f"Firma {index}"),
                "page": page,
                "required": bool(raw.get("required", True)),
                "page_width": page_width,
                "page_height": page_height,
                "x_ratio": round(x_ratio, 6),
                "y_ratio": round(y_ratio, 6),
                "width_ratio": round(width_ratio, 6),
                "height_ratio": round(height_ratio, 6),
                "x": round(x_ratio * page_width, 2),
                "y": round(y_ratio * page_height, 2),
                "width": round(width_ratio * page_width, 2),
                "height": round(height_ratio * page_height, 2),
            }
        )
    return items


def default_signature_positions(pdf_layout: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    return normalize_signature_positions([DEFAULT_SIGNATURE_BOX], pdf_layout or [dict(item) for item in DEFAULT_PDF_LAYOUT])


def generate_integrity_key_material() -> Dict[str, Any]:
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    public_key_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return {
        "private_key": private_key,
        "public_key_pem": public_key_pem.decode("ascii"),
        "digital_key_fingerprint": sha256_hex(public_key_pem),
    }


def build_integrity_payload(
    signature_request: Any,
    signature_hash: str,
    signer_email: str,
    ip_address: str,
    signed_document_hash: Optional[str] = None,
    key_material: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    material = key_material or generate_integrity_key_material()
    payload = {
        "request_id": signature_request.id,
        "document_name": signature_request.document_name or signature_request.name,
        "company_id": signature_request.company_id,
        "source_module": signature_request.source_module or "manual",
        "source_model": signature_request.source_model or "",
        "source_record_id": signature_request.source_record_id,
        "generated_document_id": signature_request.generated_document_id,
        "access_token": signature_request.access_token,
        "original_document_hash": signature_request.document_hash,
        "signed_document_hash": signed_document_hash or signature_request.signed_document_hash,
        "signature_hash": signature_hash,
        "signature_positions": signature_request.signature_positions or [],
        "signer_email": signer_email,
        "signer_ip": ip_address,
        "signed_at": signature_request.signed_at.isoformat() if signature_request.signed_at else None,
    }
    serialized = json.dumps(payload, sort_keys=True, ensure_ascii=True).encode("utf-8")
    payload["payload_hash"] = sha256_hex(serialized)
    payload["verification_algorithm"] = "ed25519"
    payload["digital_signature"] = b64encode_bytes(material["private_key"].sign(serialized))
    payload["public_key_pem"] = material["public_key_pem"]
    payload["digital_key_fingerprint"] = material["digital_key_fingerprint"]
    return payload


def merge_signature_into_pdf(
    original_pdf: bytes,
    signature_image: bytes,
    positions: List[Dict[str, Any]],
    signer_email: str,
    signed_at_iso: str,
    signature_hash: str,
    key_fingerprint: str,
) -> bytes:
    if not original_pdf:
        return b""
    if PdfReader is None or PdfWriter is None:
        raise RuntimeError("pypdf is required")
    reader = PdfReader(io.BytesIO(original_pdf))
    writer = PdfWriter()
    by_page: Dict[int, List[Dict[str, Any]]] = {}
    for position in positions:
        by_page.setdefault(int(position.get("page", 0) or 0), []).append(position)
    for page_index, page in enumerate(reader.pages):
        page_positions = by_page.get(page_index, [])
        if page_positions:
            overlay = io.BytesIO()
            pdf = reportlab_canvas.Canvas(overlay, pagesize=(float(page.mediabox.width), float(page.mediabox.height)))
            image = ImageReader(io.BytesIO(signature_image))
            for item in page_positions:
                draw_x = safe_float(item.get("x"))
                draw_y = float(page.mediabox.height) - safe_float(item.get("y")) - safe_float(item.get("height"))
                draw_width = safe_float(item.get("width"))
                draw_height = safe_float(item.get("height"))
                pdf.setLineWidth(0.8)
                pdf.setStrokeColorRGB(0.15, 0.23, 0.32)
                pdf.setFillColorRGB(1, 1, 1)
                pdf.roundRect(draw_x, draw_y, draw_width, draw_height, 7, stroke=1, fill=1)
                pdf.drawImage(
                    image,
                    draw_x + 6,
                    draw_y + max(draw_height * 0.24, 12),
                    width=max(draw_width - 12, 18),
                    height=max(draw_height - 24, 18),
                    preserveAspectRatio=True,
                    mask="auto",
                    anchor="sw",
                )
                pdf.setFont("Helvetica", 6.6)
                pdf.setFillColorRGB(0.11, 0.17, 0.25)
                pdf.drawString(draw_x + 6, draw_y + 10, f"Firmado por {signer_email}")
                pdf.drawString(draw_x + 6, draw_y + 4, f"{signed_at_iso[:19]} | h {short_hash(signature_hash)} | k {short_hash(key_fingerprint)}")
            pdf.save()
            overlay_reader = PdfReader(io.BytesIO(overlay.getvalue()))
            page.merge_page(overlay_reader.pages[0])
        writer.add_page(page)
    writer.add_metadata(
        {
            "/Producer": "YOUR ERP Signature Module",
            "/SignedBy": signer_email,
            "/SignedAt": signed_at_iso,
            "/SignatureHash": signature_hash,
            "/DigitalKeyFingerprint": key_fingerprint,
        }
    )
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()
