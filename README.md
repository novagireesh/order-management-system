# Order Management System

A self-hosted order management system for furniture exporters, reusable for any
company with the same workflow:

```
Buyer PO  →  Proforma Invoice + Carton order + Sticker order (PDF)
          →  Contractor POs (CPO-001…, one item can be split across contractors)
          →  11 production stages (Raw Taken … Final Dispatch)
          →  Dispatch  →  Remaining-to-dispatch reports
```

Runs on one PC or on a small cloud server. No internet dependency, no monthly SaaS fee.

---

## Features

**Orders** — type a product code and quantity; description, size, CBM, rate and labour
rate fill automatically from the product master. Live totals for quantity, CBM, amount and
labour. Saving generates the Proforma Invoice, Carton order and Sticker order as PDFs
(carton/sticker carry only product code, quantity and date).

**Contractor assignment** — pick a contractor, see exactly how much of each item is still
unassigned, split one item across several contractors, separate iron-fabrication POs.
PO numbers are generated automatically (`CPO-001`, prefix/width configurable) and the PO
PDF is produced in the company's own format.

**Production tracking** — every contractor line moves through:
Assigned → Raw Taken → In Process → Raw Ready → At Fumigation → At Sanding → At Potein →
At Color → At Katai & Coloring → At Polish → At Packing → Final Dispatch.
Full stage history per line, bulk stage updates, and a phone-friendly **Shop Floor** page
for supervisors.

**Dispatch** — enter dispatched quantities against a buyer PO with invoice and container
number. Remaining quantities, order status and production lines update automatically.
Dispatches can be undone.

**Reports** — on screen, as Excel or as PDF, filtered by buyer, PO, product code, date
range and contractor:

* Total orders – product code wise
* Buyer summary
* Orders – buyer & PO wise (full detail)
* Remaining to dispatch – buyer & PO wise, with CBM and amount grand totals
* Contractor orders – code, CBM, labour rate, amount, totals
* Production status

**Users and roles** — each person gets a login:

| Role | Can do | Cannot see |
|---|---|---|
| Admin | Everything, settings, users, deletion | — |
| Office assistant | Orders, PDFs, contractor POs, dispatch, reports, masters | Settings, users, deletion |
| Production supervisor | Shop Floor and stage updates | Prices, labour rates, PDFs |
| Dispatch / packing | Dispatch entry, remaining lists | Prices, labour rates |

Prices are removed on the **server** for roles that may not see them, not merely hidden in
the browser.

**Masters & settings** — products (with images), buyers, contractors, company details for
the PDF letterhead, PO/PI numbering, currencies. The company name shown in the menu, on
the login page and on every PDF comes from Settings, so the system can be rebranded for a
different company without touching code.

---

## Technology

| Layer | Choice |
|---|---|
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Database | SQLite (single file, WAL mode) |
| PDF | ReportLab |
| Excel | openpyxl |
| Frontend | Plain HTML/CSS/JavaScript — no build step, no framework |
| Deployment | Docker + Caddy (automatic HTTPS) |

Roughly 3,500 lines total. No npm, no bundler, no external services.

---

## Quick start (Windows)

```bash
pip install -r app/requirements.txt
```

Then double-click **`start.bat`** — the browser opens at <http://127.0.0.1:8765>.
First login: `admin` / `admin123` (change it in *My account*). The console also prints a
LAN address so other devices on the same Wi-Fi can use the system.

### Start with demo data

**`load-demo-data.bat`** creates a fictional dataset — 5 buyers, 8 contractors,
45 products with generated placeholder images, 8 buyer POs across every production stage,
20 contractor POs, dispatches and PDFs. Demo logins: `admin/admin123`,
`office/office123`, `supervisor/super123`, `packing/pack123`.

Use this for demonstrations; it never touches real business data.

### Deploy on the internet

See [DEPLOY.md](DEPLOY.md): one small VPS, a sub-domain, `docker compose up -d`, and Caddy
obtains the HTTPS certificate automatically.

---

## Layout

```
app/
  server.py      FastAPI app: orders, contractor POs, production, dispatch, reports
  auth.py        users, sessions, role permissions, server-side price scrubbing
  db.py          SQLite schema, settings, computed order-item view
  pdf.py         PI, carton/sticker order, contractor PO and report PDFs
  seed_demo.py   fictional demo dataset
  static/        single-page frontend (index.html, app.js, style.css)
deploy/          Caddyfile and update script
Dockerfile, docker-compose.yml
```

Everything the business owns lives in `data/` — `oms.db`, product images, generated PDFs
and automatic daily backups. **That folder is deliberately excluded from this repository**
(see `.gitignore`); back it up separately.

---

© 2026 novagireesh. All rights reserved.
