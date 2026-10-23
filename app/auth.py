"""Users, sessions and role-based permissions."""
import hashlib
import json
import os
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from db import get_db, row, rows

ROLES = ["admin", "office", "production", "dispatch"]
ROLE_LABELS = {"admin": "Admin", "office": "Office assistant", "production": "Production supervisor", "dispatch": "Dispatch / packing"}
SESSION_DAYS = 30
COOKIE = "oms_session"

# roles that may see prices / labour rates
PRICE_ROLES = {"admin", "office"}
PRICE_KEYS = {"rate", "amount", "labour_rate", "labour_amount", "remaining_amount", "total_amount", "total_labour",
              "labour", "rem_amount", "pending_amount", "labour_rate", "price"}

# (method, path-prefix) -> allowed roles. First match wins; anything not listed is allowed for every logged-in user.
RULES = [
    ("*", "/api/me", set(ROLES)),
    ("POST", "/api/logout", set(ROLES)),
    ("DELETE", "/api/orders", {"admin"}),
    ("DELETE", "/api/pos", {"admin"}),
    ("DELETE", "/api/dispatches", {"admin", "office"}),
    ("DELETE", "/api/", {"admin", "office"}),
    ("PUT", "/api/settings", {"admin"}),
    ("POST", "/api/backup", {"admin"}),
    ("*", "/api/users", {"admin"}),
    ("*", "/api/production", {"admin", "office", "production"}),
    ("POST", "/api/dispatches", {"admin", "office", "dispatch"}),
    ("POST", "/api/", {"admin", "office"}),
    ("PUT", "/api/", {"admin", "office"}),
    ("GET", "/open/", {"admin", "office"}),
    ("GET", "/pdf/", {"admin", "office"}),
]
PUBLIC = ("/api/login", "/api/brand", "/static/", "/favicon")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    name TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'production',
    password_hash TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT,
    expires_at TEXT,
    user_agent TEXT DEFAULT ''
);
"""


def hash_password(pw, salt=None):
    salt = salt or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode("utf8"), salt.encode("utf8"), 200_000).hex()
    return f"{salt}${h}"


def check_password(pw, stored):
    try:
        salt, _ = stored.split("$", 1)
    except ValueError:
        return False
    return secrets.compare_digest(hash_password(pw, salt), stored)


def init_auth():
    with get_db() as conn:
        conn.executescript(SCHEMA)
        if not conn.execute("SELECT 1 FROM users").fetchone():
            pw = os.environ.get("OMS_ADMIN_PASSWORD", "admin123")
            conn.execute("INSERT INTO users(username, name, role, password_hash) VALUES (?,?,?,?)", ("admin", "Administrator", "admin", hash_password(pw)))
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (datetime.now().isoformat(),))


def public_user(u):
    return {k: u[k] for k in ("id", "username", "name", "role", "active", "created_at") if k in u} | {"role_label": ROLE_LABELS.get(u["role"], u["role"]), "see_prices": u["role"] in PRICE_ROLES}


def login(username, password, user_agent=""):
    with get_db() as conn:
        u = row(conn.execute("SELECT * FROM users WHERE username=? AND active=1", (username.strip().lower(),)))
        if not u or not check_password(password, u["password_hash"]):
            return None, None
        token = secrets.token_urlsafe(32)
        now = datetime.now()
        conn.execute("INSERT INTO sessions(token, user_id, created_at, expires_at, user_agent) VALUES (?,?,?,?,?)",
                     (token, u["id"], now.isoformat(), (now + timedelta(days=SESSION_DAYS)).isoformat(), user_agent[:200]))
        return public_user(u), token


def logout(token):
    if token:
        with get_db() as conn:
            conn.execute("DELETE FROM sessions WHERE token=?", (token,))


def user_from_token(token):
    if not token:
        return None
    with get_db() as conn:
        u = row(conn.execute("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at > ? AND u.active=1",
                             (token, datetime.now().isoformat())))
        return public_user(u) if u else None


def allowed(method, path, role):
    for m, prefix, roles in RULES:
        if (m == "*" or m == method) and path.startswith(prefix):
            return role in roles
    return True


def scrub(obj):
    """Recursively remove price-related keys (for production / dispatch users)."""
    if isinstance(obj, dict):
        if "columns" in obj and isinstance(obj["columns"], list):
            obj["columns"] = [c for c in obj["columns"] if not (isinstance(c, dict) and c.get("key") in PRICE_KEYS)]
        return {k: scrub(v) for k, v in obj.items() if k not in PRICE_KEYS}
    if isinstance(obj, list):
        return [scrub(x) for x in obj]
    return obj


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in ("/", "/api/me") or any(path.startswith(p) for p in PUBLIC) or path.startswith("/images/"):
            return await call_next(request)
        user = user_from_token(request.cookies.get(COOKIE))
        if not user:
            if path.startswith("/api/"):
                return JSONResponse({"detail": "Please log in"}, status_code=401)
            return Response("Please log in first", status_code=401)
        if not allowed(request.method, path, user["role"]):
            return JSONResponse({"detail": f"Your role ({user['role_label']}) is not allowed to do this"}, status_code=403)
        request.state.user = user
        response = await call_next(request)
        if user["role"] not in PRICE_ROLES and path.startswith("/api/") and "application/json" in response.headers.get("content-type", ""):
            body = b"".join([chunk async for chunk in response.body_iterator])
            try:
                data = json.loads(body)
            except Exception:
                return Response(body, status_code=response.status_code, headers=dict(response.headers))
            return JSONResponse(scrub(data), status_code=response.status_code)
        return response


def require_user(request: Request):
    u = getattr(request.state, "user", None)
    if not u:
        raise HTTPException(401, "Please log in")
    return u


# ---------------------------------------------------------------- user admin helpers

def list_users():
    with get_db() as conn:
        return [public_user(u) for u in rows(conn.execute("SELECT * FROM users ORDER BY role, username"))]


def create_user(username, name, role, password):
    username = (username or "").strip().lower()
    if not username or not password:
        raise HTTPException(400, "Username and password are required")
    if role not in ROLES:
        raise HTTPException(400, "Invalid role")
    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    with get_db() as conn:
        if conn.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone():
            raise HTTPException(400, f"User {username} already exists")
        conn.execute("INSERT INTO users(username, name, role, password_hash) VALUES (?,?,?,?)", (username, name or username, role, hash_password(password)))
        return public_user(row(conn.execute("SELECT * FROM users WHERE username=?", (username,))))


def update_user(uid, data, acting_user):
    with get_db() as conn:
        u = row(conn.execute("SELECT * FROM users WHERE id=?", (uid,)))
        if not u:
            raise HTTPException(404, "User not found")
        role = data.get("role", u["role"])
        active = int(data.get("active", u["active"]))
        if role not in ROLES:
            raise HTTPException(400, "Invalid role")
        if u["id"] == acting_user["id"] and (role != "admin" or not active):
            raise HTTPException(400, "You cannot remove your own admin access")
        conn.execute("UPDATE users SET name=?, role=?, active=? WHERE id=?", (data.get("name", u["name"]), role, active, uid))
        if data.get("password"):
            if len(data["password"]) < 6:
                raise HTTPException(400, "Password must be at least 6 characters")
            conn.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(data["password"]), uid))
            conn.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
        if not active:
            conn.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
        return public_user(row(conn.execute("SELECT * FROM users WHERE id=?", (uid,))))


def change_password(uid, old, new):
    with get_db() as conn:
        u = row(conn.execute("SELECT * FROM users WHERE id=?", (uid,)))
        if not check_password(old or "", u["password_hash"]):
            raise HTTPException(400, "Current password is wrong")
        if len(new or "") < 6:
            raise HTTPException(400, "New password must be at least 6 characters")
        conn.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(new), uid))
        return {"ok": True}
