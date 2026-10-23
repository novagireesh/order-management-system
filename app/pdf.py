"""PDF generation (reportlab) for PI, carton/sticker orders, contractor POs and reports."""
import os
import re
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

from db import IMAGE_DIR, PDF_DIR

styles = getSampleStyleSheet()
S_TITLE = ParagraphStyle("t", parent=styles["Title"], fontSize=16, spaceAfter=2)
S_H = ParagraphStyle("h", parent=styles["Heading2"], fontSize=12, spaceAfter=2)
S_N = ParagraphStyle("n", parent=styles["Normal"], fontSize=9, leading=11)
S_NB = ParagraphStyle("nb", parent=S_N, fontName="Helvetica-Bold")
S_SM = ParagraphStyle("sm", parent=S_N, fontSize=8, leading=10)
S_CELL = ParagraphStyle("c", parent=S_N, fontSize=8, leading=10)
S_CELL_C = ParagraphStyle("cc", parent=S_CELL, alignment=TA_CENTER)
S_CELL_R = ParagraphStyle("cr", parent=S_CELL, alignment=TA_RIGHT)
S_BIG = ParagraphStyle("big", parent=S_N, fontSize=13, leading=16, fontName="Helvetica-Bold")
S_RIGHT = ParagraphStyle("r", parent=S_N, alignment=TA_RIGHT)

GRID = [
    ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8e8e8")),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("FONTSIZE", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 3),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
]


def safe_name(s):
    s = re.sub(r"[^A-Za-z0-9._ -]+", "_", str(s or "")).strip()
    return re.sub(r"\s+", " ", s)[:80] or "doc"


def fmt_date(d):
    if not d:
        return ""
    try:
        return datetime.strptime(str(d)[:10], "%Y-%m-%d").strftime("%d-%m-%Y")
    except Exception:
        return str(d)


def num(v, dec=2):
    try:
        v = float(v or 0)
    except Exception:
        return str(v)
    if dec == 0:
        return f"{int(round(v)):,}"
    return f"{v:,.{dec}f}"


def qty_fmt(v):
    return num(v, 0)


def P(text, style=S_CELL):
    text = "" if text is None else str(text)
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
    return Paragraph(text, style)


def img_flowable(image_name, size=18 * mm):
    if not image_name:
        return P("")
    path = os.path.join(IMAGE_DIR, image_name)
    if not os.path.exists(path):
        return P("")
    try:
        im = Image(path)
        w, h = im.imageWidth, im.imageHeight
        scale = min(size / w, size / h)
        im.drawWidth, im.drawHeight = w * scale, h * scale
        return im
    except Exception:
        return P("")


def company_header(settings, title, right_rows):
    """Two-column header: company block on the left, document title + metadata on the right."""
    left = [
        P(settings.get("company_name", ""), S_BIG),
        P(settings.get("company_address1", "")),
        P(settings.get("company_address2", "")),
        P(settings.get("company_phone", "")),
        P("E-mail : " + settings.get("company_email", "")),
        P("GST IN : " + settings.get("company_gst", "")),
    ]
    right_tbl = [[P(title, ParagraphStyle("x", parent=S_BIG, alignment=TA_RIGHT))]]
    meta = Table([[P(k, S_NB), P(v, S_RIGHT)] for k, v in right_rows], colWidths=[38 * mm, 42 * mm])
    meta.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("FONTSIZE", (0, 0), (-1, -1), 9)]))
    right_tbl.append([meta])
    right = Table(right_tbl, colWidths=[80 * mm])
    right.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    t = Table([[left, right]], colWidths=[100 * mm, 80 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return t


def _doc(path, pagesize=A4, title=""):
    return SimpleDocTemplate(path, pagesize=pagesize, leftMargin=12 * mm, rightMargin=12 * mm,
                             topMargin=10 * mm, bottomMargin=10 * mm, title=title)


# ------------------------------------------------------------------ Carton / Sticker order

def carton_sticker_pdf(kind, order, items, settings):
    """kind: 'carton' or 'sticker'. Only product code, qty and date are printed (as requested)."""
    label = "CARTON ORDER" if kind == "carton" else "STICKER ORDER"
    fname = f"{label.title()} - {safe_name(order['buyer_name'])} - {safe_name(order['po_number'])}.pdf"
    path = os.path.join(PDF_DIR, fname)
    doc = _doc(path, title=label)
    el = []
    el.append(company_header(settings, label, [
        ("DATE", fmt_date(order.get("doc_date") or datetime.now().strftime("%Y-%m-%d"))),
        ("REF", order["po_number"]),
    ]))
    el.append(Spacer(1, 6 * mm))
    data = [[P("S.NO.", S_NB), P("PRODUCT CODE", S_NB), P("QTY", S_NB)]]
    total = 0
    for i, it in enumerate(items, 1):
        data.append([P(i, S_CELL_C), P(it["code"], ParagraphStyle("k", parent=S_CELL, fontSize=11, leading=14)),
                     P(qty_fmt(it["qty"]), ParagraphStyle("q", parent=S_CELL_R, fontSize=11, leading=14))])
        total += it["qty"] or 0
    data.append([P(""), P("TOTAL", S_NB), P(qty_fmt(total), ParagraphStyle("q", parent=S_CELL_R, fontName="Helvetica-Bold", fontSize=11))])
    t = Table(data, colWidths=[20 * mm, 100 * mm, 40 * mm], repeatRows=1)
    t.setStyle(TableStyle(GRID + [("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f3f3f3"))]))
    el.append(t)
    el.append(Spacer(1, 12 * mm))
    el.append(P("Authorised Signature", S_NB))
    doc.build(el)
    return fname


# ------------------------------------------------------------------ Proforma Invoice

def pi_pdf(order, items, buyer, settings):
    cur = settings.get("currency", "USD")
    fname = f"PI {safe_name(order.get('pi_number') or '')} - {safe_name(order['buyer_name'])} - {safe_name(order['po_number'])}.pdf"
    path = os.path.join(PDF_DIR, fname)
    doc = _doc(path, pagesize=landscape(A4), title="Proforma Invoice")
    el = []
    hdr = company_header(settings, "PROFORMA INVOICE", [
        ("PI NO.", order.get("pi_number") or ""),
        ("DATE", fmt_date(order.get("order_date"))),
        ("BUYER PO", order["po_number"]),
        ("DESTINATION", order.get("destination") or ""),
    ])
    el.append(hdr)
    el.append(Spacer(1, 4 * mm))
    b = [P("BUYER", S_NB), P(buyer.get("name", "")), P(buyer.get("address", "")), P(buyer.get("country", "")),
         P(buyer.get("email", "")), P(buyer.get("phone", ""))]
    bt = Table([[b]], colWidths=[120 * mm])
    bt.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.5, colors.black)]))
    el.append(bt)
    el.append(Spacer(1, 4 * mm))
    head = ["S.NO.", "IMAGE", "PRODUCT CODE", "DESCRIPTION", "SIZE (CMS)", "QTY", f"RATE ({cur})", f"AMOUNT ({cur})", "CBM", "T.CBM"]
    data = [[P(h, S_NB) for h in head]]
    tq = ta = tc = 0
    for i, it in enumerate(items, 1):
        amt = (it["qty"] or 0) * (it["rate"] or 0)
        tcbm = (it["qty"] or 0) * (it["cbm"] or 0)
        tq += it["qty"] or 0
        ta += amt
        tc += tcbm
        data.append([P(i, S_CELL_C), img_flowable(it.get("image")), P(it["code"]), P(it.get("name")), P(it.get("size")),
                     P(qty_fmt(it["qty"]), S_CELL_R), P(num(it["rate"]), S_CELL_R), P(num(amt), S_CELL_R),
                     P(num(it["cbm"], 3), S_CELL_R), P(num(tcbm, 3), S_CELL_R)])
    data.append([P(""), P(""), P("TOTAL", S_NB), P(""), P(""), P(qty_fmt(tq), S_CELL_R), P(""), P(num(ta), S_CELL_R), P(""), P(num(tc, 3), S_CELL_R)])
    t = Table(data, colWidths=[14 * mm, 22 * mm, 30 * mm, 76 * mm, 38 * mm, 14 * mm, 20 * mm, 24 * mm, 16 * mm, 18 * mm], repeatRows=1)
    t.setStyle(TableStyle(GRID + [("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f3f3f3"))]))
    el.append(t)
    el.append(Spacer(1, 6 * mm))
    sumt = Table([[P("Total Quantity", S_NB), P(qty_fmt(tq), S_CELL_R), P("Total CBM", S_NB), P(num(tc, 3), S_CELL_R), P("Total Amount", S_NB), P(f"{cur} {num(ta)}", S_CELL_R)]],
                 colWidths=[30 * mm, 22 * mm, 30 * mm, 22 * mm, 30 * mm, 30 * mm])
    sumt.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f7f7f7"))]))
    sumt.hAlign = "LEFT"
    el.append(sumt)
    if order.get("notes"):
        el.append(Spacer(1, 3 * mm))
        el.append(P("Notes: " + order["notes"]))
    el.append(Spacer(1, 12 * mm))
    el.append(P("For " + settings.get("company_name", ""), S_NB))
    el.append(Spacer(1, 10 * mm))
    el.append(P("Authorised Signature", S_NB))
    doc.build(el)
    return fname


# ------------------------------------------------------------------ Contractor / Iron PO

def contractor_po_pdf(po, contractor, items, settings):
    is_iron = contractor.get("type") == "iron"
    label = "IRON PURCHASE ORDER" if is_iron else "PURCHASE ORDER"
    fname = f"PO {safe_name(po['po_number'])} - {safe_name(contractor['name'])}.pdf"
    path = os.path.join(PDF_DIR, fname)
    doc = _doc(path, pagesize=landscape(A4), title=label)
    el = []
    el.append(P("VENDOR COPY", S_SM))
    meta = [("DATE", fmt_date(po.get("po_date"))), ("PO #", po["po_number"])]
    if not is_iron:
        meta.append(("MOISTURE CONTENT", settings.get("moisture_content", "7-8%")))
    if po.get("delivery_date"):
        meta.append(("DELIVERY DATE", fmt_date(po.get("delivery_date"))))
    el.append(company_header(settings, label, meta))
    el.append(Spacer(1, 4 * mm))
    vendor = [P("VENDOR", S_NB), P(contractor.get("name", ""), S_BIG), P(contractor.get("address", "") or settings.get("company_city", "")), P(contractor.get("phone", ""))]
    ship = [P("SHIP TO", S_NB), P(settings.get("ship_to_name", ""), S_NB), P(settings.get("ship_to_address1", "")),
            P(settings.get("ship_to_address2", "")), P(settings.get("ship_to_phone", "")),
            P("E-mail : " + settings.get("company_email", "")), P("GST IN : " + settings.get("company_gst", ""))]
    vt = Table([[vendor, ship]], colWidths=[130 * mm, 130 * mm])
    vt.setStyle(TableStyle([("BOX", (0, 0), (0, 0), 0.5, colors.black), ("BOX", (1, 0), (1, 0), 0.5, colors.black), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    el.append(vt)
    el.append(Spacer(1, 4 * mm))
    head = ["S.NO.", "IMAGE", "ITEM CODE", "NAME", "SIZE (CMS)", "BUYER / PO", "QTY", "CBM", "T.CBM", "RATE", "TOTAL AMOUNT", "DELIVERY DATE"]
    data = [[P(h, S_NB) for h in head]]
    tq = tc = ta = 0
    for i, it in enumerate(items, 1):
        amt = (it["qty"] or 0) * (it["labour_rate"] or 0)
        tcbm = (it["qty"] or 0) * (it["cbm"] or 0)
        tq += it["qty"] or 0
        tc += tcbm
        ta += amt
        data.append([P(i, S_CELL_C), img_flowable(it.get("image"), 20 * mm), P(it["code"]), P(it.get("name")), P(it.get("size")),
                     P(str(it.get("buyer_name", "")) + chr(10) + str(it.get("po_number", ""))),
                     P(qty_fmt(it["qty"]), S_CELL_R), P(num(it.get("cbm"), 3), S_CELL_R), P(num(tcbm, 3), S_CELL_R),
                     P(num(it["labour_rate"]), S_CELL_R), P(num(amt), S_CELL_R), P(fmt_date(po.get("delivery_date")), S_CELL_C)])
    data.append([P(""), P(""), P("TOTALS", S_NB), P(""), P(""), P(""), P(qty_fmt(tq), S_CELL_R), P(""), P(num(tc, 3), S_CELL_R), P(""), P(num(ta), S_CELL_R), P("")])
    t = Table(data, colWidths=[14 * mm, 24 * mm, 28 * mm, 54 * mm, 34 * mm, 30 * mm, 14 * mm, 14 * mm, 16 * mm, 16 * mm, 22 * mm, 22 * mm], repeatRows=1)
    t.setStyle(TableStyle(GRID + [("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f3f3f3"))]))
    el.append(t)
    el.append(Spacer(1, 4 * mm))
    if po.get("notes"):
        el.append(P("Comments or Special Instructions: " + po["notes"], S_N))
    if is_iron:
        notes = ["NOTE 1 : GST APPLICABLE AS PER RATES ON ABOVE VALUE", "NOTE 2 : Product Should be in given size",
                 "Note 3 : Check Sample Product before Start Production or Check Drawing given", "Note 4 : FOR at our factory"]
    else:
        notes = ["NOTE 1 : GST APPLICABLE AS PER RATES ON ABOVE VALUE",
                 "NOTE 2 : All product manufactured in the factory (In House Production)",
                 "NOTE 3 : Product Should be in given size",
                 "Note 4 : Check Sample Product before Start Production or Check Drawing given."]
    block = [P(n, S_SM) for n in notes]
    sig = Table([[block, [P("ESTIMATED DELIVERY DATE: " + fmt_date(po.get("delivery_date")), S_NB), Spacer(1, 8 * mm), P("Authorised Signature", S_NB)]]],
                colWidths=[150 * mm, 110 * mm])
    sig.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    el.append(KeepTogether(sig))
    el.append(Spacer(1, 10 * mm))
    st = Table([[P("Contractor Signature with date", S_NB), P("Super-visior Signature", S_NB)]], colWidths=[150 * mm, 110 * mm])
    el.append(st)
    el.append(Spacer(1, 6 * mm))
    el.append(P("If you have any questions about this purchase order, please contact to office", S_SM))
    el.append(P(f"Subject to {settings.get('company_city', 'local')} jurisdiction", S_SM))
    el.append(P("Delay will not be accepted", S_SM))
    doc.build(el)
    return fname


# ------------------------------------------------------------------ Generic report

def report_pdf(title, subtitle, columns, data_rows, settings, filename=None, totals=None, group_rows=None):
    """columns: list of (label, key, align, width_mm). data_rows: list of dicts. group_rows: set of row indexes styled as group headers."""
    fname = filename or f"{safe_name(title)} {datetime.now().strftime('%Y-%m-%d %H%M%S')}.pdf"
    path = os.path.join(PDF_DIR, fname)
    total_w = sum(c[3] for c in columns)
    pagesize = landscape(A4) if total_w > 180 else A4
    doc = _doc(path, pagesize=pagesize, title=title)
    avail = pagesize[0] / mm - 24
    if total_w > avail:  # shrink columns proportionally so the table always fits the page
        scale = avail / total_w
        columns = [(c[0], c[1], c[2], c[3] * scale) for c in columns]
    el = [P(settings.get("company_name", ""), S_BIG), P(title, S_TITLE)]
    if subtitle:
        el.append(P(subtitle, S_N))
    el.append(Spacer(1, 4 * mm))
    small = len(columns) > 11
    fs = 7 if small else 8
    hs = ParagraphStyle("hs", parent=S_NB, fontSize=fs, leading=fs + 2)
    cl, cr, cc = (ParagraphStyle(n_, parent=b, fontSize=fs, leading=fs + 2) for n_, b in (("cl", S_CELL), ("cr", S_CELL_R), ("cc", S_CELL_C)))
    data = [[P(c[0], hs) for c in columns]]
    style = list(GRID)
    for ri, r in enumerate(data_rows, 1):
        cells = []
        for label, key, align, w in columns:
            v = r.get(key, "")
            st = cr if align == "r" else cc if align == "c" else cl
            if r.get("_bold"):
                st = ParagraphStyle("b", parent=st, fontName="Helvetica-Bold")
            cells.append(P(v, st))
        data.append(cells)
        if r.get("_group"):
            style.append(("BACKGROUND", (0, ri), (-1, ri), colors.HexColor("#dfe8f5")))
            style.append(("SPAN", (0, ri), (-1, ri)))
        elif r.get("_bold"):
            style.append(("BACKGROUND", (0, ri), (-1, ri), colors.HexColor("#f3f3f3")))
    if totals:
        cells = []
        for label, key, align, w in columns:
            v = totals.get(key, "")
            st = cr if align == "r" else cl
            cells.append(P(v, ParagraphStyle("b", parent=st, fontName="Helvetica-Bold")))
        data.append(cells)
        style.append(("BACKGROUND", (0, len(data) - 1), (-1, len(data) - 1), colors.HexColor("#ffe9b3")))
    t = Table(data, colWidths=[c[3] * mm for c in columns], repeatRows=1)
    t.setStyle(TableStyle(style))
    el.append(t)
    el.append(Spacer(1, 4 * mm))
    el.append(P("Generated " + datetime.now().strftime("%d-%m-%Y %H:%M"), S_SM))
    doc.build(el)
    return fname
