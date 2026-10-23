"""Fill the demo database with fictional buyers, contractors, products, orders, POs, stages, dispatches and users.
Run:  python seed_demo.py   (deletes data/oms.db first)"""
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import DB_PATH, IMAGE_DIR, PDF_DIR, STAGES, get_db, init_db, set_setting  # noqa: E402

random.seed(42)

BUYERS = [
    ("NORDIC HOME AB", "Industrigatan 14, 211 20 Malmo", "Sweden", "orders@nordichome.example", "+46 40 000 000"),
    ("MAPLE & OAK LLC", "2200 Commerce Dr, High Point, NC 27260", "USA", "purchasing@mapleoak.example", "+1 336 000 0000"),
    ("CASA VERDE SL", "Calle Mayor 8, 46001 Valencia", "Spain", "compras@casaverde.example", "+34 96 000 0000"),
    ("URBAN LIVING GmbH", "Hafenstrasse 22, 20457 Hamburg", "Germany", "einkauf@urbanliving.example", "+49 40 000000"),
    ("DESERT DECOR TRADING", "Al Quoz Industrial 3, Dubai", "UAE", "buying@desertdecor.example", "+971 4 000 0000"),
]
CONTRACTORS = [
    ("Ramesh Carpentry", "wood", "Sitapura, Jaipur", "98290 00001"),
    ("Suresh Woodworks", "wood", "Sanganer, Jaipur", "98290 00002"),
    ("Mahesh & Sons", "wood", "Bagru Road, Jaipur", "98290 00003"),
    ("Dinesh Furniture Unit", "wood", "VKIA, Jaipur", "98290 00004"),
    ("In-House Workshop", "wood", "Factory", ""),
    ("Shakti Iron Works", "iron", "Jhotwara, Jaipur", "98290 00005"),
    ("Royal Packaging", "carton", "Jaipur", "98290 00006"),
    ("Label Print House", "sticker", "Jaipur", "98290 00007"),
]
# code prefix per buyer, and product templates: (name, size, cbm, rate, labour, finish, colour)
PRODUCTS = [
    ("MANGO WOOD 2 DOOR SIDEBOARD", "150X40X76", 0.456, 165, 950, "NATURAL", (176, 120, 70)),
    ("MANGO WOOD 3 DRAWER CHEST", "90X40X80", 0.288, 120, 650, "WALNUT", (120, 80, 50)),
    ("ROUND COFFEE TABLE SET OF 2", "80X80X40, 60X60X35", 0.240, 95, 550, "LIGHT BLEACH", (200, 170, 130)),
    ("ORGANIC SHAPE DINING TABLE 6 SEATER", "200X100X76", 0.450, 245, 1100, "NATURAL", (170, 115, 65)),
    ("DINING BENCH WITH IRON LEG", "150X38X45", 0.110, 62, 300, "SAND", (190, 150, 100)),
    ("WALL HANG BEDSIDE 1 DRAWER", "45X35X20", 0.045, 28, 220, "LIGHT BLEACH", (205, 175, 135)),
    ("BEDSIDE TABLE 2 DRAWER", "50X40X60", 0.120, 55, 350, "WALNUT", (115, 78, 48)),
    ("CONSOLE TABLE WITH GROOVE DESIGN", "120X35X76", 0.180, 88, 450, "NATURAL", (172, 118, 68)),
    ("TV UNIT 2 DOOR 1 DRAWER", "140X40X55", 0.310, 140, 700, "SAND", (188, 148, 98)),
    ("FOLDING BOOK SHELF 5 TIER", "64X44X148", 0.091, 45, 300, "NATURAL", (178, 122, 72)),
    ("SIDE TABLE WITH CARVED LEG SET OF 2", "46X46X50, 40X40X45", 0.165, 60, 400, "LIGHT BLEACH", (202, 172, 132)),
    ("WINE RACK WITH 3 TRAYS", "40X40X78", 0.168, 48, 280, "NATURAL", (175, 120, 70)),
    ("DRESSING TABLE WITH MIRROR", "110X40X150", 0.420, 210, 1000, "WALNUT", (118, 80, 50)),
    ("COAT RACK 6 HOOKS", "100X32X5", 0.020, 22, 120, "SAND", (192, 152, 102)),
    ("ROUND END TABLE", "45X45X55", 0.075, 35, 200, "NATURAL", (176, 120, 70)),
    ("CANE DOOR CABINET", "80X40X120", 0.400, 195, 950, "LIGHT BLEACH", (200, 172, 130)),
    ("FLUTED DESIGN NIGHT STAND", "45X40X60", 0.110, 58, 380, "WALNUT", (120, 82, 52)),
    ("KIDS STUDY DESK WITH CHAIR", "100X50X75, 40X40X80", 0.320, 130, 700, "NATURAL", (178, 124, 74)),
    ("BAR CABINET WITH IRON FRAME", "90X45X110", 0.445, 230, 1050, "SAND", (190, 150, 100)),
    ("NESTED COFFEE TABLE SET OF 3", "90X52X40, 70X38X40, 50X26X40", 0.292, 110, 600, "LIGHT BLEACH", (204, 174, 134)),
]
PREFIX = {"NORDIC HOME AB": "NH-", "MAPLE & OAK LLC": "MO-", "CASA VERDE SL": "CV-", "URBAN LIVING GmbH": "UL-", "DESERT DECOR TRADING": "DD-"}


def draw_image(code, colour, fname):
    """Simple placeholder product picture: coloured furniture-like block with the code printed on it."""
    im = Image.new("RGB", (400, 400), (245, 243, 238))
    d = ImageDraw.Draw(im)
    dark = tuple(max(0, c - 45) for c in colour)
    d.rounded_rectangle([60, 120, 340, 300], radius=18, fill=colour, outline=dark, width=4)
    d.rectangle([70, 150, 330, 156], fill=dark)
    d.rectangle([195, 130, 205, 290], fill=dark)
    for x in (85, 315):
        d.rectangle([x - 8, 300, x + 8, 350], fill=dark)
    d.ellipse([150, 205, 170, 225], fill=(90, 60, 40))
    d.ellipse([230, 205, 250, 225], fill=(90, 60, 40))
    try:
        font = ImageFont.truetype("arial.ttf", 30)
    except Exception:
        font = ImageFont.load_default()
    d.text((200, 60), code, fill=(40, 40, 40), anchor="mm", font=font)
    d.text((200, 375), "DEMO IMAGE", fill=(150, 150, 150), anchor="mm", font=font)
    im.save(os.path.join(IMAGE_DIR, fname), "JPEG", quality=85)


def main():
    for f in (DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm"):
        if os.path.exists(f):
            os.remove(f)
    for d in (IMAGE_DIR, PDF_DIR):
        for f in os.listdir(d):
            os.remove(os.path.join(d, f))
    init_db()
    import auth
    auth.init_auth()
    with get_db() as conn:
        buyer_ids = {}
        for name, addr, country, email, phone in BUYERS:
            conn.execute("INSERT INTO buyers(name, address, country, email, phone) VALUES (?,?,?,?,?)", (name, addr, country, email, phone))
            buyer_ids[name] = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        ctr_ids = {}
        for name, typ, addr, phone in CONTRACTORS:
            conn.execute("INSERT INTO contractors(name, type, address, phone) VALUES (?,?,?,?)", (name, typ, addr, phone))
            ctr_ids[name] = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        wood = [ctr_ids[n] for n, t, _, _ in CONTRACTORS if t == "wood"]
        iron = ctr_ids["Shakti Iron Works"]

        # products: every buyer gets its own codes for a subset of the catalogue
        products = {}  # code -> dict
        n = 1000
        for bname in buyer_ids:
            for name, size, cbm, rate, labour, finish, colour in random.sample(PRODUCTS, 9):
                code = f"{PREFIX[bname]}{n}"
                n += 1
                fname = code.replace("-", "_") + ".jpg"
                draw_image(code, colour, fname)
                conn.execute("INSERT INTO products(code, name, internal_code, size, cbm, rate, labour_rate, finish, image, buyer_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
                             (code, name, f"WW{random.randint(10000, 19999)}", size, cbm, rate, labour, finish, fname, buyer_ids[bname]))
                products[code] = dict(id=conn.execute("SELECT last_insert_rowid()").fetchone()[0], code=code, name=name, size=size, cbm=cbm, rate=rate,
                                      labour=labour, finish=finish, buyer=bname)

        # orders
        order_specs = [  # buyer, po, date, status-plan
            ("NORDIC HOME AB", "NH-24051", "2026-05-12", "closed"),
            ("MAPLE & OAK LLC", "PO-88213", "2026-06-03", "partly"),
            ("CASA VERDE SL", "CV/2026/117", "2026-06-25", "production"),
            ("URBAN LIVING GmbH", "UL-7731", "2026-07-14", "production"),
            ("NORDIC HOME AB", "NH-24088", "2026-08-02", "production"),
            ("DESERT DECOR TRADING", "DD-0912", "2026-08-21", "partly-assigned"),
            ("MAPLE & OAK LLC", "PO-88402", "2026-09-05", "new"),
            ("CASA VERDE SL", "CV/2026/131", "2026-09-12", "new"),
        ]
        po_counter = 1
        item_rows = []  # (order_item_id, product, qty, plan, order_id, buyer)
        for bname, po, odate, plan in order_specs:
            conn.execute("INSERT INTO orders(buyer_id, po_number, order_date, pi_number, destination, status) VALUES (?,?,?,?,?,?)",
                         (buyer_ids[bname], po, odate, f"PI-{po_counter:03d}", random.choice(["", "", "Rotterdam", "Savannah", "Jebel Ali"]), "open"))
            oid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            set_setting(conn, "pi_next_number", po_counter + 1)
            po_counter += 1
            codes = random.sample([c for c in products if products[c]["buyer"] == bname], random.randint(4, 7))
            for sno, code in enumerate(codes, 1):
                p = products[code]
                qty = random.choice([10, 20, 25, 40, 50, 60, 100])
                iron_req = 1 if "IRON" in p["name"] else 0
                conn.execute("""INSERT INTO order_items(order_id, product_id, sno, code, name, size, qty, rate, cbm, labour_rate, finish, iron_required,
                                carton_ordered_at, sticker_ordered_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                             (oid, p["id"], sno, code, p["name"], p["size"], qty, p["rate"], p["cbm"], p["labour"], p["finish"], iron_req,
                              odate if plan != "new" else None, odate if plan != "new" else None))
                item_rows.append((conn.execute("SELECT last_insert_rowid()").fetchone()[0], p, qty, plan, oid, bname, iron_req, odate))

        # contractor POs: group items per (order, contractor)
        cpo_num = 1
        stage_for_plan = {"closed": 11, "partly": (8, 11), "production": (1, 8), "partly-assigned": (0, 3)}
        po_ids = {}
        for oi_id, p, qty, plan, oid, bname, iron_req, odate in item_rows:
            if plan == "new":
                continue
            if plan == "partly-assigned" and random.random() < 0.4:
                continue  # leave some quantity unassigned
            splits = [(random.choice(wood), qty)] if random.random() < 0.7 else [(wood[0], qty // 2), (wood[1], qty - qty // 2)]
            for cid, q in splits:
                key = (oid, cid)
                if key not in po_ids:
                    conn.execute("INSERT INTO contractor_pos(po_number, contractor_id, po_date, delivery_date, notes) VALUES (?,?,?,?,?)",
                                 (f"CPO-{cpo_num:03d}", cid, odate, None, ""))
                    po_ids[key] = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
                    cpo_num += 1
                st = stage_for_plan[plan]
                stage = st if isinstance(st, int) else random.randint(*st)
                conn.execute("INSERT INTO contractor_po_items(po_id, order_item_id, qty, labour_rate, stage, stage_date) VALUES (?,?,?,?,?,?)",
                             (po_ids[key], oi_id, q, p["labour"], stage, odate))
                piid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
                for s_ in range(0, stage + 1):
                    conn.execute("INSERT INTO stage_log(po_item_id, stage, log_date, note) VALUES (?,?,?,?)", (piid, s_, odate, "PO created" if s_ == 0 else ""))
            if iron_req:
                key = (oid, iron)
                if key not in po_ids:
                    conn.execute("INSERT INTO contractor_pos(po_number, contractor_id, po_date) VALUES (?,?,?)", (f"CPO-{cpo_num:03d}", iron, odate))
                    po_ids[key] = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
                    cpo_num += 1
                conn.execute("INSERT INTO contractor_po_items(po_id, order_item_id, qty, labour_rate, stage, stage_date) VALUES (?,?,?,?,?,?)",
                             (po_ids[key], oi_id, qty, 150, 3, odate))
        set_setting(conn, "po_next_number", cpo_num)

        # dispatches
        inv = 2101
        for oid, plan in {(r[4], r[3]) for r in item_rows}:
            if plan not in ("closed", "partly"):
                continue
            conn.execute("INSERT INTO dispatches(order_id, dispatch_date, invoice_no, container) VALUES (?,?,?,?)", (oid, "2026-08-28", str(inv), f"MSKU{random.randint(100000, 999999)}"))
            did = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            inv += 1
            for oi_id, p, qty, pl, o2, b, ir, od in item_rows:
                if o2 != oid:
                    continue
                dq = qty if plan == "closed" else (qty if random.random() < 0.5 else qty // 2)
                if dq:
                    conn.execute("INSERT INTO dispatch_items(dispatch_id, order_item_id, qty) VALUES (?,?,?)", (did, oi_id, dq))
            if plan == "closed":
                conn.execute("UPDATE orders SET status='closed' WHERE id=?", (oid,))

        # demo users
        for u, name, role, pw in [("office", "Priya (Office)", "office", "office123"), ("supervisor", "Ramesh (Supervisor)", "production", "super123"),
                                  ("packing", "Packing Team", "dispatch", "pack123")]:
            conn.execute("INSERT INTO users(username, name, role, password_hash) VALUES (?,?,?,?)", (u, name, role, auth.hash_password(pw)))

    # generate PDFs through the server's own functions
    import server
    with get_db() as conn:
        for o in conn.execute("SELECT id FROM orders").fetchall():
            server._generate_order_docs(conn, o[0])
        for p in conn.execute("SELECT id FROM contractor_pos").fetchall():
            server._generate_po_doc(conn, p[0])
    print("Demo data ready. Logins: admin/admin123, office/office123, supervisor/super123, packing/pack123")


if __name__ == "__main__":
    main()
