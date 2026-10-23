"""SQLite database layer for the Order Management System."""
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.environ.get("OMS_DATA_DIR") or os.path.join(BASE_DIR, "data")
IMAGE_DIR = os.path.join(DATA_DIR, "images")
PDF_DIR = os.path.join(DATA_DIR, "pdf")
DB_PATH = os.path.join(DATA_DIR, "oms.db")

for d in (DATA_DIR, IMAGE_DIR, PDF_DIR):
    os.makedirs(d, exist_ok=True)

STAGES = [
    "Assigned",
    "Raw Taken",
    "In Process",
    "Raw Ready",
    "At Fumigation",
    "At Sanding",
    "At Potein",
    "At Color",
    "At Katai & Coloring",
    "At Polish",
    "At Packing",
    "Final Dispatch",
]

CONTRACTOR_TYPES = ["wood", "iron", "carton", "sticker", "other"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
CREATE TABLE IF NOT EXISTS buyers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    address TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    country TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS contractors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'wood',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT DEFAULT '',
    internal_code TEXT DEFAULT '',
    size TEXT DEFAULT '',
    cbm REAL DEFAULT 0,
    rate REAL DEFAULT 0,
    labour_rate REAL DEFAULT 0,
    finish TEXT DEFAULT '',
    image TEXT DEFAULT '',
    buyer_id INTEGER REFERENCES buyers(id),
    notes TEXT DEFAULT '',
    active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id),
    po_number TEXT NOT NULL,
    order_date TEXT,
    pi_number TEXT DEFAULT '',
    destination TEXT DEFAULT '',
    status TEXT DEFAULT 'open',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(buyer_id, po_number)
);
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    sno INTEGER DEFAULT 0,
    code TEXT NOT NULL,
    name TEXT DEFAULT '',
    size TEXT DEFAULT '',
    qty REAL NOT NULL DEFAULT 0,
    rate REAL DEFAULT 0,
    cbm REAL DEFAULT 0,
    labour_rate REAL DEFAULT 0,
    finish TEXT DEFAULT '',
    iron_required INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    carton_ordered_at TEXT,
    sticker_ordered_at TEXT,
    iron_ordered_at TEXT
);
CREATE TABLE IF NOT EXISTS contractor_pos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT NOT NULL UNIQUE,
    contractor_id INTEGER NOT NULL REFERENCES contractors(id),
    po_date TEXT,
    delivery_date TEXT,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS contractor_po_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL REFERENCES contractor_pos(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    qty REAL NOT NULL DEFAULT 0,
    labour_rate REAL DEFAULT 0,
    stage INTEGER DEFAULT 0,
    stage_date TEXT,
    remarks TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS stage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_item_id INTEGER NOT NULL REFERENCES contractor_po_items(id) ON DELETE CASCADE,
    stage INTEGER NOT NULL,
    log_date TEXT,
    note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS dispatches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    dispatch_date TEXT,
    invoice_no TEXT DEFAULT '',
    container TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS dispatch_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dispatch_id INTEGER NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    qty REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    ref_type TEXT NOT NULL,
    ref_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON contractor_po_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_oi ON contractor_po_items(order_item_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_oi ON dispatch_items(order_item_id);
"""

DEFAULT_SETTINGS = {
    "company_name": "DEMO FURNITURE EXPORTS",
    "company_short": "DEMO FURNITURE",
    "company_address1": "PLOT 12, INDUSTRIAL AREA",
    "company_address2": "SAMPLE CITY - 000000 (INDIA)",
    "company_phone": "Phone: 000-0000000",
    "company_email": "info@demofurniture.example",
    "company_gst": "00AAAAA0000A0Z0",
    "company_city": "Sample City",
    "ship_to_name": "DEMO FURNITURE EXPORTS",
    "ship_to_address1": "FACTORY UNIT 2, INDUSTRIAL AREA",
    "ship_to_address2": "SAMPLE CITY - 000000 (INDIA)",
    "ship_to_phone": "Ph.: 00000 00000",
    "po_prefix": "CPO-",
    "po_next_number": "1",
    "po_suffix": "",
    "po_number_width": "3",
    "pi_prefix": "PI-",
    "pi_next_number": "1",
    "moisture_content": "7-8%",
    "currency": "USD",
    "labour_currency": "INR",
}


def connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db():
    conn = connect()
    conn.executescript(SCHEMA)
    for k, v in DEFAULT_SETTINGS.items():
        conn.execute("INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)", (k, v))
    conn.commit()
    conn.close()


@contextmanager
def get_db():
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def rows(cur):
    return [dict(r) for r in cur.fetchall()]


def row(cur):
    r = cur.fetchone()
    return dict(r) if r else None


def get_settings(conn):
    return {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings")}


def set_setting(conn, key, value):
    conn.execute(
        "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, str(value)),
    )


def next_po_number(conn):
    """Generate the next contractor PO number (e.g. CPO-001) and bump the counter."""
    s = get_settings(conn)
    n = int(s.get("po_next_number", "1") or 1)
    width = int(s.get("po_number_width", "3") or 3)
    prefix = s.get("po_prefix", "CPO-")
    suffix = s.get("po_suffix", "")
    while True:
        num = f"{prefix}{str(n).zfill(width)}{suffix}"
        exists = conn.execute("SELECT 1 FROM contractor_pos WHERE po_number=?", (num,)).fetchone()
        if not exists:
            break
        n += 1
    set_setting(conn, "po_next_number", n + 1)
    return num


def next_pi_number(conn):
    s = get_settings(conn)
    n = int(s.get("pi_next_number", "1") or 1)
    prefix = s.get("pi_prefix", "PI-")
    while True:
        num = f"{prefix}{str(n).zfill(3)}"
        exists = conn.execute("SELECT 1 FROM orders WHERE pi_number=?", (num,)).fetchone()
        if not exists:
            break
        n += 1
    set_setting(conn, "pi_next_number", n + 1)
    return num


def today():
    return datetime.now().strftime("%Y-%m-%d")


# ---------- Computed views used by API and reports ----------

ORDER_ITEM_SQL = """
SELECT oi.*, o.po_number, o.order_date, o.buyer_id, o.status AS order_status, o.destination, o.pi_number,
       b.name AS buyer_name, p.image,
       COALESCE((SELECT SUM(di.qty) FROM dispatch_items di WHERE di.order_item_id = oi.id), 0) AS dispatched_qty,
       COALESCE((SELECT SUM(pi.qty) FROM contractor_po_items pi JOIN contractor_pos cp ON cp.id = pi.po_id
                 JOIN contractors c ON c.id = cp.contractor_id WHERE pi.order_item_id = oi.id AND c.type = 'wood'), 0) AS assigned_qty,
       COALESCE((SELECT SUM(pi.qty) FROM contractor_po_items pi JOIN contractor_pos cp ON cp.id = pi.po_id
                 JOIN contractors c ON c.id = cp.contractor_id WHERE pi.order_item_id = oi.id AND c.type = 'iron'), 0) AS iron_assigned_qty,
       (SELECT GROUP_CONCAT(c.name || ' (' || CAST(pi.qty AS INTEGER) || ')', ', ')
          FROM contractor_po_items pi JOIN contractor_pos cp ON cp.id = pi.po_id JOIN contractors c ON c.id = cp.contractor_id
         WHERE pi.order_item_id = oi.id) AS contractors,
       (SELECT MIN(pi.stage) FROM contractor_po_items pi WHERE pi.order_item_id = oi.id) AS min_stage,
       (SELECT MAX(pi.stage) FROM contractor_po_items pi WHERE pi.order_item_id = oi.id) AS max_stage
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN buyers b ON b.id = o.buyer_id
LEFT JOIN products p ON p.id = oi.product_id
"""


def enrich_item(it):
    it["remaining_qty"] = (it.get("qty") or 0) - (it.get("dispatched_qty") or 0)
    it["remaining_to_assign"] = (it.get("qty") or 0) - (it.get("assigned_qty") or 0)
    it["t_cbm"] = round((it.get("qty") or 0) * (it.get("cbm") or 0), 3)
    it["amount"] = round((it.get("qty") or 0) * (it.get("rate") or 0), 2)
    it["labour_amount"] = round((it.get("qty") or 0) * (it.get("labour_rate") or 0), 2)
    it["remaining_cbm"] = round(it["remaining_qty"] * (it.get("cbm") or 0), 3)
    it["remaining_amount"] = round(it["remaining_qty"] * (it.get("rate") or 0), 2)
    ms = it.get("min_stage")
    if ms is not None and 0 <= ms < len(STAGES):
        it["stage_name"] = STAGES[ms]
    else:
        it["stage_name"] = "Not assigned"
    if it["remaining_qty"] <= 0 and (it.get("qty") or 0) > 0:
        it["item_status"] = "Dispatched"
    elif it.get("dispatched_qty"):
        it["item_status"] = "Partly dispatched"
    else:
        it["item_status"] = "Pending"
    return it


def fetch_order_items(conn, where="", params=()):
    sql = ORDER_ITEM_SQL + (" WHERE " + where if where else "") + " ORDER BY o.order_date, o.id, oi.sno, oi.id"
    return [enrich_item(r) for r in rows(conn.execute(sql, params))]
