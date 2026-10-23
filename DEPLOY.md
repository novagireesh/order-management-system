# Putting the Order Management System on the internet

Goal: your team opens **https://oms.yourcompany.com** from any phone or PC, logs in with
their own username, and sees only what their role allows.

Everything runs in Docker on one small cloud server. Data (database, images, PDFs,
backups) lives in the `data/` folder on that server. Cost: roughly ₹500–1,000 / month.

---

## 1. What you need (one time)

| Item | Where | Notes |
|---|---|---|
| A small Linux server (VPS) | Hetzner (CX22), DigitalOcean (Basic $6), Contabo, Hostinger VPS, AWS Lightsail… | Ubuntu 22.04 / 24.04, 2 GB RAM is plenty |
| A domain or sub-domain | Your existing domain registrar (e.g. GoDaddy, Namecheap, Hostinger) | Create an **A record**: `oms` → server IP |
| SSH access to the server | The provider gives you the root password / key | Use PuTTY or Windows Terminal |

## 2. Prepare the server (run once, on the server)

```bash
# log in:  ssh root@YOUR_SERVER_IP
apt update && apt install -y docker.io docker-compose-v2 git unzip
systemctl enable --now docker
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
mkdir -p /opt/oms
```

## 3. Copy the system to the server

From your PC, copy this whole folder to the server. Easiest: zip it, upload with WinSCP (or `scp`), unzip in `/opt/oms`.

```bash
# on your PC (PowerShell) – example using scp
scp -r "E:\Order Management System\app" "E:\Order Management System\deploy" "E:\Order Management System\data" "E:\Order Management System\Dockerfile" "E:\Order Management System\docker-compose.yml" "E:\Order Management System\.env.example" root@YOUR_SERVER_IP:/opt/oms/
```

`data/` contains your live database, product images and generated PDFs — copy it so the
online system starts with all your current orders. **Stop the local start.bat before
copying so the database file is not in use.**

## 4. Configure and start

```bash
cd /opt/oms
cp .env.example .env
nano .env          # set DOMAIN=oms.yourcompany.com and a strong OMS_ADMIN_PASSWORD, save (Ctrl+O, Enter, Ctrl+X)
docker compose up -d --build
docker compose logs -f oms   # Ctrl+C to stop watching
```

Wait about a minute; Caddy obtains a free HTTPS certificate automatically. Then open
`https://oms.yourcompany.com` and log in as **admin**.

> If the `data/` folder you copied already contains users, the admin password is the one
> from that database (default `admin123` on first run) — change it right away in
> **My account**. `OMS_ADMIN_PASSWORD` in `.env` is only used when the database has no users yet.

## 5. Create logins for the team

**Users & logins** (admin only) → **+ New user**:

| Role | Can do | Cannot see |
|---|---|---|
| Admin | Everything, settings, users, delete | – |
| Office assistant | Enter buyer POs, PI / carton / sticker PDFs, assign contractors, print POs, dispatch, all reports | Settings, users, delete |
| Production supervisor | **Shop Floor** (phone page) – move items through the 11 stages, Contractor PO list | Prices, labour rates, buyer amounts, PDFs |
| Dispatch / packing | Dispatch entry, remaining-to-dispatch lists, order lists | Prices, labour rates |

Share the address `https://oms.yourcompany.com` and each person's username/password.
On a phone, open the address in Chrome → menu → **Add to Home screen** – it then behaves
like an app.

## 6. Day-to-day server tasks

| Task | Command (on the server, in `/opt/oms`) |
|---|---|
| See status | `docker compose ps` |
| Restart | `docker compose restart oms` |
| Update after code changes | copy new `app/` files, then `sh deploy/update.sh` |
| Manual backup | Settings → *Backup database now* (saved in `data/backups/`) – automatic backup runs every 24 h, 60 copies kept |
| Copy backups to your PC | `scp root@YOUR_SERVER_IP:/opt/oms/data/backups/*.db D:\OMS-backups\` |
| Server updates | `apt update && apt upgrade -y` once a month |

## 7. Alternatives

* **Factory Wi-Fi only (free):** just run `start.bat` on one office PC. The black window
  prints an address like `http://192.168.1.25:8765` – other devices on the same Wi-Fi use
  that. Keep that PC on. (The login and roles work the same way.)
* **Access from home without a public server:** install **Tailscale** (free) on the
  office PC and on your phone/laptop; then use the office PC's Tailscale address. No domain
  or VPS needed, but the office PC must stay on.
