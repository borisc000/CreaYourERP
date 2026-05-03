"""PDF export renderer for preoperational Gantt plans."""

from __future__ import annotations

import re
import unicodedata
from calendar import monthrange
from datetime import date, datetime, timedelta
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from reportlab.lib import colors
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A3, A4, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


WEEKDAY_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
MONTH_LABELS = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
]

SCOPE_LABELS = {
    "project_span": "Plan completo",
    "current_month": "Mes del plan",
    "current_week": "Semana operativa",
}

VIEW_MODE_LABELS = {
    "daily": "Vista diaria",
    "weekly": "Vista semanal",
    "monthly": "Vista mensual",
}


def _clean_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_date(value: Any, fallback: Optional[date] = None) -> Optional[date]:
    if value in (None, ""):
        return fallback
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = _clean_text(value)
    if not text:
        return fallback
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        try:
            return datetime.fromisoformat(text.replace("Z", "")).date()
        except ValueError:
            return fallback


def _fmt_date(value: Any) -> str:
    parsed = _parse_date(value)
    return parsed.strftime("%d/%m/%Y") if parsed else "--"


def _chunk(items: List[Any], size: int) -> List[List[Any]]:
    if size <= 0:
        return [items]
    return [items[index:index + size] for index in range(0, len(items), size)] or [[]]


def _safe_color(value: Any, fallback: str = "#2563eb") -> Color:
    try:
        return HexColor(_clean_text(value, fallback))
    except Exception:
        return HexColor(fallback)


def _mix(color_a: Color, color_b: Color, ratio: float) -> Color:
    weight = max(0.0, min(1.0, ratio))
    return Color(
        (color_a.red * (1 - weight)) + (color_b.red * weight),
        (color_a.green * (1 - weight)) + (color_b.green * weight),
        (color_a.blue * (1 - weight)) + (color_b.blue * weight),
    )


def _lighten(color_value: Color, ratio: float = 0.18) -> Color:
    return _mix(color_value, colors.white, ratio)


def _darken(color_value: Color, ratio: float = 0.18) -> Color:
    return _mix(color_value, colors.black, ratio)


def _truncate(text: str, max_width: float, font_name: str = "Helvetica", font_size: float = 8) -> str:
    source = _clean_text(text)
    if not source:
        return ""
    if stringWidth(source, font_name, font_size) <= max_width:
        return source
    ellipsis = "..."
    trimmed = source
    while trimmed and stringWidth(trimmed + ellipsis, font_name, font_size) > max_width:
        trimmed = trimmed[:-1]
    return (trimmed + ellipsis) if trimmed else ellipsis


def wrap_text_to_width(text: Any, font_name: str, font_size: float, max_width: float) -> List[str]:
    source = _clean_text(text)
    if not source:
        return []
    if max_width <= 4:
        return [source]

    paragraphs = [segment.strip() for segment in source.splitlines() if segment.strip()] or [source]
    wrapped: List[str] = []
    for paragraph in paragraphs:
        words = paragraph.split()
        if not words:
            continue

        current = ""
        for word in words:
            candidate = word if not current else f"{current} {word}"
            if stringWidth(candidate, font_name, font_size) <= max_width:
                current = candidate
                continue

            if current:
                wrapped.append(current)
                current = ""

            if stringWidth(word, font_name, font_size) <= max_width:
                current = word
                continue

            fragment = ""
            for char in word:
                test_fragment = fragment + char
                if not fragment or stringWidth(test_fragment, font_name, font_size) <= max_width:
                    fragment = test_fragment
                else:
                    wrapped.append(fragment)
                    fragment = char
            current = fragment

        if current:
            wrapped.append(current)
    return wrapped or [source]


def fit_text_block(
    lines: Any,
    box_width: float,
    box_height: float,
    base_font_size: float,
    min_font_size: float,
    max_lines: int,
    font_name: str = "Helvetica",
    leading_factor: float = 1.18,
) -> Dict[str, Any]:
    source_lines = lines if isinstance(lines, list) else [lines]
    normalized_lines = [_clean_text(line) for line in source_lines if _clean_text(line)]
    if not normalized_lines:
        return {"lines": [], "font_size": base_font_size, "leading": base_font_size * leading_factor}

    font_size = base_font_size
    while font_size >= min_font_size - 0.01:
        leading = max(font_size * leading_factor, font_size + 1)
        wrapped: List[str] = []
        for line in normalized_lines:
            wrapped.extend(wrap_text_to_width(line, font_name, font_size, box_width))

        if wrapped and len(wrapped) <= max_lines and (len(wrapped) * leading) <= box_height:
            return {
                "lines": wrapped,
                "font_size": font_size,
                "leading": leading,
            }
        font_size = round(font_size - 0.4, 2)

    font_size = min_font_size
    leading = max(font_size * leading_factor, font_size + 1)
    wrapped = []
    for line in normalized_lines:
        wrapped.extend(wrap_text_to_width(line, font_name, font_size, box_width))

    allowed_lines = max(1, min(max_lines, int(box_height / max(leading, 1))))
    if len(wrapped) <= allowed_lines:
        visible_lines = wrapped
    else:
        visible_lines = wrapped[: max(allowed_lines - 1, 0)]
        remainder = " ".join(wrapped[max(allowed_lines - 1, 0):])
        visible_lines.append(_truncate(remainder, box_width, font_name, font_size))

    return {
        "lines": visible_lines,
        "font_size": font_size,
        "leading": leading,
    }


def draw_fitted_text(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    text: Any,
    font_name: str = "Helvetica",
    base_font_size: float = 9,
    min_font_size: float = 7,
    max_lines: int = 2,
    color: Color = colors.black,
    align: str = "left",
    valign: str = "top",
    leading_factor: float = 1.18,
) -> Dict[str, Any]:
    layout = fit_text_block(
        text,
        width,
        height,
        base_font_size,
        min_font_size,
        max_lines,
        font_name=font_name,
        leading_factor=leading_factor,
    )
    lines = layout.get("lines") or []
    if not lines:
        return layout

    line_height = layout["leading"]
    text_height = line_height * len(lines)
    if valign == "middle":
        start_y = y + ((height + text_height) / 2) - layout["font_size"]
    elif valign == "bottom":
        start_y = y + text_height - layout["font_size"]
    else:
        start_y = y + height - layout["font_size"]

    pdf.setFillColor(color)
    pdf.setFont(font_name, layout["font_size"])
    for index, line in enumerate(lines):
        baseline_y = start_y - (index * line_height)
        if align == "center":
            pdf.drawCentredString(x + (width / 2), baseline_y, line)
        elif align == "right":
            pdf.drawRightString(x + width, baseline_y, line)
        else:
            pdf.drawString(x, baseline_y, line)
    return layout


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^A-Za-z0-9]+", "-", normalized).strip("-").lower()
    return normalized or "gantt-preoperacional"


def _task_overlaps(task: Dict[str, Any], start_date: date, end_date: date) -> bool:
    task_start = _parse_date(task.get("planned_start_date"))
    task_end = _parse_date(task.get("planned_end_date"), task_start)
    return bool(task_start and task_end and task_start <= end_date and task_end >= start_date)


def _draw_pill(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    fill_color: Color,
    text: str,
    font_size: float = 7,
):
    pdf.setFillColor(fill_color)
    pdf.roundRect(x, y, width, height, height / 2, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", font_size)
    pdf.drawCentredString(x + (width / 2), y + (height / 2) - (font_size / 2.7), text)


def _resolve_view_mode(total_days: int) -> str:
    if total_days <= 45:
        return "daily"
    if total_days <= 120:
        return "weekly"
    return "monthly"


def _build_periods(start_date: date, end_date: date, view_mode: str, today: date) -> List[Dict[str, Any]]:
    periods: List[Dict[str, Any]] = []
    cursor = start_date
    while cursor <= end_date:
        if view_mode == "weekly":
            period_end = min(end_date, cursor + timedelta(days=6))
            label_top = f"{cursor.day:02d}-{period_end.day:02d}"
            label_bottom = MONTH_LABELS[cursor.month - 1]
            label_hint = str(cursor.year) if cursor.year != period_end.year else ""
        elif view_mode == "monthly":
            last_day = monthrange(cursor.year, cursor.month)[1]
            month_end = date(cursor.year, cursor.month, last_day)
            period_end = min(end_date, month_end)
            label_top = MONTH_LABELS[cursor.month - 1]
            label_bottom = str(cursor.year)
            label_hint = f"{cursor.day:02d}-{period_end.day:02d}" if cursor.day != 1 or period_end != month_end else ""
        else:
            period_end = cursor
            label_top = WEEKDAY_LABELS[cursor.weekday()]
            label_bottom = f"{cursor.day:02d}"
            label_hint = MONTH_LABELS[cursor.month - 1]

        periods.append(
            {
                "start_date": cursor,
                "end_date": period_end,
                "label_top": label_top,
                "label_bottom": label_bottom,
                "label_hint": label_hint,
                "is_today": cursor <= today <= period_end,
                "is_weekend": view_mode == "daily" and cursor.weekday() >= 5,
            }
        )
        cursor = period_end + timedelta(days=1)
    return periods


def _task_period_span(task: Dict[str, Any], periods: List[Dict[str, Any]]) -> Optional[Tuple[int, int]]:
    task_start = _parse_date(task.get("planned_start_date"))
    task_end = _parse_date(task.get("planned_end_date"), task_start)
    if not task_start or not task_end:
        return None
    first_index = None
    last_index = None
    for index, period in enumerate(periods):
        if task_start <= period["end_date"] and task_end >= period["start_date"]:
            if first_index is None:
                first_index = index
            last_index = index
    if first_index is None or last_index is None:
        return None
    return first_index, last_index


def _choose_page_size(period_count: int, task_count: int, view_mode: str) -> Tuple[Tuple[float, float], bool]:
    if view_mode == "daily":
        use_a3 = period_count > 28 or task_count > 16
    elif view_mode == "weekly":
        use_a3 = period_count > 18 or task_count > 20
    else:
        use_a3 = period_count > 14 or task_count > 24
    return landscape(A3 if use_a3 else A4), use_a3


def build_gantt_pdf(plan_payload: Dict[str, Any], scope: str = "project_span") -> Tuple[bytes, str]:
    timeline = plan_payload.get("timeline") or {}
    window = timeline.get(scope) or timeline.get("project_span") or {}
    scope_key = scope if scope in SCOPE_LABELS else "project_span"
    scope_label = SCOPE_LABELS.get(scope_key, "Plan completo")

    window_start = _parse_date(window.get("start_date")) or _parse_date(plan_payload.get("planned_start_date")) or date.today()
    window_end = _parse_date(window.get("end_date"), window_start) or window_start
    if window_end < window_start:
        window_end = window_start

    total_days = max((window_end - window_start).days + 1, 1)
    today = _parse_date(timeline.get("today")) or date.today()
    view_mode = _resolve_view_mode(total_days)
    view_mode_label = VIEW_MODE_LABELS.get(view_mode, "Vista diaria")
    periods = _build_periods(window_start, window_end, view_mode, today)

    tasks = [task for task in (plan_payload.get("tasks") or []) if _task_overlaps(task, window_start, window_end)]
    tasks.sort(
        key=lambda item: (
            _safe_int(item.get("display_order"), 10),
            _parse_date(item.get("planned_start_date"), window_start) or window_start,
            _clean_text(item.get("task_name")).lower(),
        )
    )

    page_size, use_a3 = _choose_page_size(len(periods), len(tasks), view_mode)
    page_width, page_height = page_size
    margin_x = 28 if use_a3 else 22
    margin_y = 18 if use_a3 else 16
    header_height = 72 if use_a3 else 66
    context_row_height = 46 if use_a3 else 42
    procedure_row_height = 54 if use_a3 else 48
    summary_row_height = 40 if use_a3 else 38
    legend_height = 16
    footer_height = 18
    label_width = 258 if use_a3 else 220
    row_height = 44 if len(tasks) <= 12 else 40
    inner_padding = 12
    period_header_height = 34
    stack_gap = 4
    legend_gap = 8
    top_stack_height = (
        header_height
        + context_row_height
        + procedure_row_height
        + summary_row_height
        + legend_height
        + (stack_gap * 3)
        + legend_gap
        + 8
    )
    chart_top = page_height - margin_y - top_stack_height
    chart_bottom = margin_y + footer_height
    chart_height = chart_top - chart_bottom
    chart_width = page_width - (margin_x * 2)
    grid_width = chart_width - label_width - (inner_padding * 2)

    column_target = {
        "daily": 25 if use_a3 else 22,
        "weekly": 42 if use_a3 else 36,
        "monthly": 64 if use_a3 else 56,
    }.get(view_mode, 22)
    periods_per_page = max(4, int(grid_width / column_target))
    tasks_per_page = max(1, int((chart_height - period_header_height - inner_padding) / row_height))
    period_slices = _chunk(periods, periods_per_page)
    task_slices = _chunk(tasks, tasks_per_page) if tasks else [[]]
    total_pages = max(1, len(period_slices) * len(task_slices))

    summary = plan_payload.get("summary") or {}
    lead = plan_payload.get("lead") or {}
    procedure = plan_payload.get("procedure") or {}
    export_context = plan_payload.get("export_context") or {}
    phases = plan_payload.get("lookups", {}).get("phases") or []

    project_code = _clean_text(
        export_context.get("project_code") or lead.get("project_code"),
        f"lead-{plan_payload.get('lead_id') or plan_payload.get('id') or 'plan'}",
    )
    lead_title = _clean_text(lead.get("title"), "Oportunidad")
    plan_name = _clean_text(plan_payload.get("plan_name"), f"Plan Gantt preoperacional {project_code}")
    procedure_code = _clean_text(export_context.get("procedure_code") or procedure.get("procedure_code"), "PTS")
    procedure_name = _clean_text(export_context.get("procedure_name") or procedure.get("name"), "Procedimiento base")
    procedure_version = _clean_text(export_context.get("procedure_version") or procedure.get("version"))
    stage_name = _clean_text(export_context.get("stage_name"))
    status_label = _clean_text(export_context.get("plan_status_label") or plan_payload.get("status_label"), "Borrador")
    created_at = datetime.now().strftime("%d/%m/%Y %H:%M")
    safe_filename = f"carta-gantt-{_slugify(project_code)}-{date.today().isoformat()}.pdf"

    context_cards = [
        ("Cliente", _clean_text(export_context.get("client_name"), "Sin cliente"), "#2563eb"),
        ("Servicio", _clean_text(export_context.get("service_name"), lead_title or plan_name), "#0f766e"),
        ("Tipo de servicio", _clean_text(export_context.get("service_type_name"), "No definido"), "#7c3aed"),
        (
            "Procedimiento",
            _clean_text(export_context.get("procedure_label"), " | ".join([bit for bit in [procedure_code, procedure_name, procedure_version] if bit])),
            "#f59e0b",
        ),
    ]
    summary_cards = [
        ("Rango real", f"{_fmt_date(summary.get('window_start_date'))} - {_fmt_date(summary.get('window_end_date'))}", "#2563eb"),
        ("Actividades", str(summary.get("tasks_total") or 0), "#0f766e"),
        ("Avance", f"{round(float(summary.get('avg_progress_pct') or 0))}%", "#7c3aed"),
        ("Bloqueadas", str(summary.get("blocked_tasks") or 0), "#dc2626"),
    ]

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=page_size)
    pdf.setAuthor("YOUR ERP")
    pdf.setTitle(f"Carta Gantt Preoperacional {project_code}")
    pdf.setSubject(f"{scope_label} - {lead_title}")

    card_gap = 10
    context_card_width = (chart_width - (card_gap * 2)) / 3
    metric_card_width = (chart_width - (card_gap * 3)) / 4

    def draw_metric_card(x: float, y: float, title: str, value: str, accent: str):
        accent_color = colors.HexColor(accent)
        height = summary_row_height
        padding_x = 12
        label_baseline = y + height - 18
        value_y = y + 5
        value_height = max(height - 22, 14)
        pdf.setFillColor(colors.white)
        pdf.setStrokeColor(_mix(colors.HexColor("#cbd5e1"), accent_color, 0.18))
        pdf.roundRect(x, y, metric_card_width, height, 16, stroke=1, fill=1)
        pdf.setFillColor(accent_color)
        pdf.roundRect(x + padding_x, y + height - 10, 36, 4, 2, stroke=0, fill=1)
        pdf.setFillColor(colors.HexColor("#5b6b81"))
        pdf.setFont("Helvetica-Bold", 6.5)
        pdf.drawString(x + padding_x, label_baseline, _truncate(title.upper(), metric_card_width - (padding_x * 2), "Helvetica-Bold", 6.5))
        draw_fitted_text(
            pdf,
            x + padding_x,
            value_y,
            metric_card_width - (padding_x * 2),
            value_height,
            value,
            font_name="Helvetica-Bold",
            base_font_size=11.2 if use_a3 else 10.0,
            min_font_size=7.8 if use_a3 else 7.2,
            max_lines=2,
            color=colors.HexColor("#0f172a"),
            valign="middle",
            leading_factor=1.08,
        )

    def draw_context_card(x: float, y: float, width: float, height: float, title: str, value: str, accent: str, max_lines: int = 2):
        accent_color = colors.HexColor(accent)
        padding_x = 12
        label_baseline = y + height - 18
        value_y = y + 5
        value_height = max(height - 22, 16)
        pdf.setFillColor(colors.white)
        pdf.setStrokeColor(_mix(colors.HexColor("#dbe4f0"), accent_color, 0.14))
        pdf.roundRect(x, y, width, height, 16, stroke=1, fill=1)
        pdf.setFillColor(accent_color)
        pdf.roundRect(x + padding_x, y + height - 10, 36, 4, 2, stroke=0, fill=1)
        pdf.setFillColor(colors.HexColor("#5b6b81"))
        pdf.setFont("Helvetica-Bold", 6.5)
        pdf.drawString(x + padding_x, label_baseline, _truncate(title.upper(), width - (padding_x * 2), "Helvetica-Bold", 6.5))
        draw_fitted_text(
            pdf,
            x + padding_x,
            value_y,
            width - (padding_x * 2),
            value_height,
            value,
            font_name="Helvetica-Bold",
            base_font_size=(9.4 if max_lines >= 3 else 9.2) if use_a3 else (8.8 if max_lines >= 3 else 8.6),
            min_font_size=7.0 if use_a3 else 6.6,
            max_lines=max_lines,
            color=colors.HexColor("#0f172a"),
            valign="middle",
            leading_factor=1.12,
        )

    def draw_header(page_number: int, visible_periods: List[Dict[str, Any]], visible_tasks: List[Dict[str, Any]], period_slice_index: int, task_slice_index: int):
        header_y = page_height - margin_y - header_height
        pdf.setFillColor(colors.HexColor("#0f172a"))
        pdf.roundRect(margin_x, header_y, chart_width, header_height, 24, stroke=0, fill=1)
        pdf.setFillColor(colors.HexColor("#2563eb"))
        pdf.roundRect(margin_x + 16, header_y + 16, 5, header_height - 32, 2.5, stroke=0, fill=1)
        title_x = margin_x + 30
        info_width = 248 if use_a3 else 216
        info_height = header_height - 18
        info_y = header_y + 9
        info_x = margin_x + chart_width - info_width - 12
        title_width = info_x - title_x - 20

        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 15 if use_a3 else 14)
        pdf.drawString(title_x, header_y + header_height - 21, "Carta Gantt Preoperacional")
        draw_fitted_text(
            pdf,
            title_x,
            header_y + 18,
            title_width,
            18,
            plan_name,
            font_name="Helvetica-Bold",
            base_font_size=11.6 if use_a3 else 10.6,
            min_font_size=8.9 if use_a3 else 8.2,
            max_lines=2,
            color=colors.white,
            valign="top",
            leading_factor=1.1,
        )

        meta_parts = [project_code]
        if stage_name:
            meta_parts.append(stage_name)
        if status_label:
            meta_parts.append(status_label)
        pdf.setFillColor(colors.HexColor("#bfdbfe"))
        pdf.setFont("Helvetica", 7.2)
        pdf.drawString(title_x, header_y + 10, _truncate(" | ".join(meta_parts), title_width, "Helvetica", 7.2))

        pdf.setFillColor(colors.HexColor("#28439a"))
        pdf.roundRect(info_x, info_y, info_width, info_height, 16, stroke=0, fill=1)
        pdf.setFillColor(colors.HexColor("#bfdbfe"))
        pdf.setFont("Helvetica-Bold", 7.2)
        pdf.drawString(info_x + 14, info_y + info_height - 14, "VISTA EXPORTADA")
        visible_start = visible_periods[0]["start_date"] if visible_periods else window_start
        visible_end = visible_periods[-1]["end_date"] if visible_periods else window_end
        box_left = info_x + 14
        box_width = info_width - 28
        mode_line = f"{view_mode_label} | {'A3 apaisado' if use_a3 else 'A4 apaisado'} | Generado {created_at}"
        draw_fitted_text(
            pdf,
            box_left,
            info_y + 18,
            box_width,
            14,
            scope_label,
            font_name="Helvetica-Bold",
            base_font_size=10.4 if use_a3 else 9.5,
            min_font_size=8.0 if use_a3 else 7.4,
            max_lines=1,
            color=colors.white,
            valign="top",
            leading_factor=1.1,
        )
        draw_fitted_text(
            pdf,
            box_left,
            info_y + 4,
            box_width,
            16,
            [
                f"{_fmt_date(visible_start)} - {_fmt_date(visible_end)}",
                mode_line,
            ],
            font_name="Helvetica",
            base_font_size=7.0 if use_a3 else 6.6,
            min_font_size=6.2 if use_a3 else 5.9,
            max_lines=2,
            color=colors.white,
            valign="middle",
            leading_factor=1.14,
        )

        context_y = header_y - stack_gap - context_row_height
        for index, card in enumerate(context_cards[:3]):
            draw_context_card(
                margin_x + (index * (context_card_width + card_gap)),
                context_y,
                context_card_width,
                context_row_height,
                card[0],
                card[1],
                card[2],
                max_lines=2,
            )

        procedure_card = context_cards[3]
        procedure_y = context_y - stack_gap - procedure_row_height
        draw_context_card(
            margin_x,
            procedure_y,
            chart_width,
            procedure_row_height,
            procedure_card[0],
            procedure_card[1],
            procedure_card[2],
            max_lines=3,
        )

        metrics_y = procedure_y - stack_gap - summary_row_height
        for index, metric in enumerate(summary_cards):
            draw_metric_card(
                margin_x + (index * (metric_card_width + card_gap)),
                metrics_y,
                metric[0],
                metric[1],
                metric[2],
            )

        legend_y = metrics_y - legend_gap
        pdf.setFillColor(colors.HexColor("#475569"))
        pdf.setFont("Helvetica-Bold", 7.2)
        pdf.drawString(margin_x, legend_y, "FASES")
        pill_x = margin_x + 36
        pill_y = legend_y - 7
        for phase in phases[:5]:
            label = _clean_text(phase.get("label"))
            color_value = _safe_color(phase.get("color"))
            pill_width = max(54, stringWidth(label, "Helvetica-Bold", 6.2) + 16)
            _draw_pill(pdf, pill_x, pill_y, pill_width, 12, color_value, _truncate(label, pill_width - 10, "Helvetica-Bold", 6.2), 6.2)
            pill_x += pill_width + 6

        period_total = len(periods) or len(visible_periods)
        task_total = len(tasks) or len(visible_tasks)
        pdf.setFillColor(colors.HexColor("#64748b"))
        pdf.setFont("Helvetica", 7.1)
        period_from = 1 + (period_slice_index * periods_per_page)
        period_to = min((period_slice_index + 1) * periods_per_page, period_total)
        if task_total:
            task_from = 1 + (task_slice_index * tasks_per_page)
            task_to = min((task_slice_index + 1) * tasks_per_page, task_total)
            slice_text = f"Tramo {period_from}-{period_to} de {period_total} | Actividades {task_from}-{task_to} de {task_total}"
        else:
            slice_text = f"Tramo {period_from}-{period_to} de {period_total} | Sin actividades"
        pdf.drawRightString(margin_x + chart_width, legend_y, _truncate(slice_text, 290 if use_a3 else 240, "Helvetica", 7.1))

    page_number = 0
    for period_slice_index, period_chunk in enumerate(period_slices):
        for task_slice_index, task_chunk in enumerate(task_slices):
            page_number += 1
            draw_header(page_number, period_chunk, task_chunk, period_slice_index, task_slice_index)

            panel_x = margin_x
            panel_y = chart_bottom
            panel_height = chart_height
            pdf.setFillColor(colors.HexColor("#f8fafc"))
            pdf.setStrokeColor(colors.HexColor("#d7e1ee"))
            pdf.roundRect(panel_x, panel_y, chart_width, panel_height, 20, stroke=1, fill=1)

            left_x = panel_x + inner_padding
            grid_x = left_x + label_width
            usable_grid_width = chart_width - label_width - (inner_padding * 2)
            header_y = panel_y + panel_height - period_header_height - inner_padding
            body_y = panel_y + inner_padding
            body_height = panel_height - period_header_height - (inner_padding * 2)
            period_width = usable_grid_width / max(len(period_chunk), 1)

            pdf.setFillColor(colors.HexColor("#e2e8f0"))
            pdf.roundRect(left_x, header_y, label_width, period_header_height, 14, stroke=0, fill=1)
            pdf.setFillColor(colors.HexColor("#0f172a"))
            pdf.setFont("Helvetica-Bold", 7.2)
            pdf.drawString(left_x + 10, header_y + 11, "ACTIVIDAD / BLOQUE")

            pdf.setFillColor(colors.HexColor("#eff6ff"))
            pdf.roundRect(grid_x, header_y, usable_grid_width, period_header_height, 14, stroke=0, fill=1)
            for period_index, period in enumerate(period_chunk):
                column_x = grid_x + (period_index * period_width)
                if period.get("is_weekend"):
                    pdf.setFillColor(colors.HexColor("#f1f5f9"))
                    pdf.rect(column_x, body_y, period_width, body_height, stroke=0, fill=1)
                    pdf.rect(column_x, header_y, period_width, period_header_height, stroke=0, fill=1)
                if period.get("is_today"):
                    pdf.setFillColor(colors.HexColor("#dbeafe"))
                    pdf.rect(column_x, body_y, period_width, body_height, stroke=0, fill=1)
                    pdf.rect(column_x, header_y, period_width, period_header_height, stroke=0, fill=1)

                pdf.setStrokeColor(colors.HexColor("#d7e3f2"))
                pdf.setLineWidth(0.6)
                pdf.line(column_x, body_y, column_x, header_y + period_header_height)
                pdf.setFillColor(colors.HexColor("#334155"))
                pdf.setFont("Helvetica", 6.0)
                pdf.drawCentredString(column_x + (period_width / 2), header_y + 18, _truncate(period.get("label_top"), period_width - 4, "Helvetica", 6.0))
                pdf.setFont("Helvetica-Bold", 6.6)
                pdf.drawCentredString(column_x + (period_width / 2), header_y + 9, _truncate(period.get("label_bottom"), period_width - 4, "Helvetica-Bold", 6.6))
                if period.get("label_hint") and period_width > 34:
                    pdf.setFillColor(colors.HexColor("#64748b"))
                    pdf.setFont("Helvetica", 5.1)
                    pdf.drawCentredString(column_x + (period_width / 2), header_y + 1, _truncate(period.get("label_hint"), period_width - 4, "Helvetica", 5.1))

            pdf.setStrokeColor(colors.HexColor("#d7e3f2"))
            pdf.line(grid_x + usable_grid_width, body_y, grid_x + usable_grid_width, header_y + period_header_height)

            if not task_chunk:
                pdf.setFillColor(colors.HexColor("#64748b"))
                pdf.setFont("Helvetica", 10)
                pdf.drawCentredString(panel_x + (chart_width / 2), body_y + (body_height / 2), "No hay actividades en este tramo para exportar.")
            else:
                for row_index, task in enumerate(task_chunk):
                    row_y = header_y - ((row_index + 1) * row_height)
                    if row_y < body_y:
                        break

                    if row_index % 2 == 0:
                        pdf.setFillColor(colors.HexColor("#fbfdff"))
                        pdf.rect(left_x, row_y, label_width + usable_grid_width, row_height, stroke=0, fill=1)

                    pdf.setStrokeColor(colors.HexColor("#e2e8f0"))
                    pdf.setLineWidth(0.8)
                    pdf.line(left_x, row_y, left_x + label_width + usable_grid_width, row_y)
                    pdf.line(grid_x, row_y, grid_x, row_y + row_height)

                    task_name = _truncate(task.get("task_name") or "Actividad", label_width - 88, "Helvetica-Bold", 8.0)
                    meta_text = _truncate(
                        f"{task.get('block_code') or task.get('block_name') or 'Bloque libre'} | {task.get('owner_name') or 'Sin responsable'}",
                        label_width - 22,
                        "Helvetica",
                        6.4,
                    )
                    pdf.setFillColor(colors.HexColor("#0f172a"))
                    pdf.setFont("Helvetica-Bold", 8.0)
                    pdf.drawString(left_x + 10, row_y + row_height - 11, task_name)
                    pdf.setFillColor(colors.HexColor("#64748b"))
                    pdf.setFont("Helvetica", 6.4)
                    pdf.drawString(left_x + 10, row_y + 7, meta_text)

                    pill_text = _truncate(task.get("status_label") or task.get("status") or "Pendiente", 54, "Helvetica-Bold", 6.0)
                    pill_width = max(54, stringWidth(pill_text, "Helvetica-Bold", 6.0) + 16)
                    _draw_pill(
                        pdf,
                        left_x + label_width - pill_width - 10,
                        row_y + row_height - 17,
                        pill_width,
                        11,
                        _darken(_safe_color(task.get("bar_color")), 0.08),
                        pill_text,
                        6.0,
                    )

                    period_span = _task_period_span(task, period_chunk)
                    if period_span:
                        start_index, end_index = period_span
                        visible_periods = max((end_index - start_index) + 1, 1)
                        bar_x = grid_x + (start_index * period_width) + 2
                        bar_width = max((visible_periods * period_width) - 4, 10)
                        bar_height = min(14, row_height - 24)
                        bar_y = row_y + row_height - bar_height - 9
                        bar_color = _safe_color(task.get("bar_color"))
                        task_start = _parse_date(task.get("planned_start_date"))
                        task_end = _parse_date(task.get("planned_end_date"), task_start)

                        pdf.setFillColor(_lighten(bar_color, 0.12))
                        pdf.roundRect(bar_x, bar_y, bar_width, bar_height, bar_height / 2, stroke=0, fill=1)
                        pdf.setFillColor(bar_color)
                        pdf.roundRect(bar_x, bar_y, bar_width, bar_height, bar_height / 2, stroke=0, fill=1)

                        progress = max(0, min(100, _safe_int(task.get("progress_pct"), 0)))
                        if progress > 0:
                            pdf.setFillColor(_darken(bar_color, 0.18))
                            pdf.roundRect(bar_x, bar_y, max((bar_width * progress) / 100, 7), bar_height, bar_height / 2, stroke=0, fill=1)

                        if _clean_text(task.get("status")) == "blocked":
                            pdf.setFillColor(colors.HexColor("#991b1b"))
                            pdf.roundRect(bar_x + bar_width - 8, bar_y, 8, bar_height, bar_height / 2, stroke=0, fill=1)

                        if bar_width > 64:
                            pdf.setFillColor(colors.white)
                            pdf.setFont("Helvetica-Bold", 6.4)
                            inside_label = _truncate(
                                f"{task.get('phase_label') or 'Fase'} | {progress}%",
                                bar_width - 12,
                                "Helvetica-Bold",
                                6.4,
                            )
                            pdf.drawString(bar_x + 6, bar_y + 5, inside_label)

                        date_label = f"Inicio {_fmt_date(task_start)}  |  Termino {_fmt_date(task_end)}"
                        pdf.setFillColor(colors.HexColor("#475569"))
                        pdf.setFont("Helvetica-Bold", 5.6)
                        if bar_width > 72:
                            pdf.drawCentredString(
                                bar_x + (bar_width / 2),
                                row_y + 8,
                                _truncate(date_label, bar_width - 4, "Helvetica-Bold", 5.6),
                            )
                        else:
                            pdf.drawString(
                                max(grid_x + 2, min(bar_x, grid_x + usable_grid_width - 78)),
                                row_y + 8,
                                _truncate(date_label, 76, "Helvetica-Bold", 5.6),
                            )

            pdf.setStrokeColor(colors.HexColor("#e2e8f0"))
            pdf.line(left_x, body_y, left_x + label_width + usable_grid_width, body_y)
            footer_left = " | ".join([bit for bit in [project_code, procedure_code] if bit])
            footer_right = f"Pagina {page_number}/{total_pages}"
            pdf.setFillColor(colors.HexColor("#64748b"))
            pdf.setFont("Helvetica", 8)
            pdf.drawString(margin_x, margin_y - 1, _truncate(footer_left, 220 if use_a3 else 180, "Helvetica", 8))
            pdf.drawRightString(page_width - margin_x, margin_y - 1, footer_right)

            if page_number < total_pages:
                pdf.showPage()

    pdf.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes, safe_filename
