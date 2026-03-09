"""
JWT 認証モジュール
- ユーザー登録・ログイン
- JWT トークン発行・検証
- 認証ミドルウェア（FastAPI Depends）
"""

import os
import logging
import hashlib
import hmac
import secrets
import time
import json
import base64
from typing import Optional
from functools import wraps

from fastapi import APIRouter, HTTPException, Body, Request, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr

try:
    from backend.db import connect_db
except Exception:
    try:
        from db import connect_db  # type: ignore
    except Exception:
        connect_db = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/api/auth', tags=['auth'])

# ── Config ────────────────────────────────────────────

def _get_or_create_jwt_secret() -> str:
    """環境変数 JWT_SECRET があればそれを使い、なければファイルに永続化して再利用する。
    --reload によるサーバーリロードでもシークレットが変わらないようにする。"""
    env_secret = os.environ.get('JWT_SECRET', '').strip()
    if env_secret:
        return env_secret
    # データディレクトリにシークレットファイルを保存
    secret_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    os.makedirs(secret_dir, exist_ok=True)
    secret_file = os.path.join(secret_dir, '.jwt_secret')
    try:
        if os.path.exists(secret_file):
            with open(secret_file, 'r') as f:
                stored = f.read().strip()
            if stored:
                return stored
    except Exception:
        pass
    # 新規生成して保存
    new_secret = secrets.token_hex(32)
    try:
        with open(secret_file, 'w') as f:
            f.write(new_secret)
        logger.info('JWT_SECRET を %s に保存しました（サーバー再起動後も有効）', secret_file)
    except Exception:
        logger.warning('JWT_SECRET のファイル保存に失敗。再起動時にトークンが無効になります。')
    return new_secret

JWT_SECRET = _get_or_create_jwt_secret()
JWT_ACCESS_EXPIRY = 30 * 60          # 30 minutes
JWT_REFRESH_EXPIRY = 7 * 24 * 60 * 60  # 7 days


# ── Minimal JWT implementation (no PyJWT dependency) ──

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += '=' * padding
    return base64.urlsafe_b64decode(s)


def _jwt_sign(payload: dict, secret: str = JWT_SECRET, expiry: int = JWT_ACCESS_EXPIRY) -> str:
    """Create a HS256 JWT token."""
    header = {'alg': 'HS256', 'typ': 'JWT'}
    payload = {**payload, 'iat': int(time.time()), 'exp': int(time.time()) + expiry}
    segments = [
        _b64url_encode(json.dumps(header).encode()),
        _b64url_encode(json.dumps(payload).encode()),
    ]
    signing_input = '.'.join(segments).encode()
    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    segments.append(_b64url_encode(signature))
    return '.'.join(segments)


def _jwt_verify(token: str, secret: str = JWT_SECRET) -> Optional[dict]:
    """Verify and decode a HS256 JWT token. Returns None if invalid."""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        signing_input = f'{parts[0]}.{parts[1]}'.encode()
        expected_sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
        actual_sig = _b64url_decode(parts[2])
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload = json.loads(_b64url_decode(parts[1]))
        if payload.get('exp', 0) < time.time():
            return None
        return payload
    except Exception:
        return None


# ── Password hashing (PBKDF2, no extra deps) ─────────

def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100_000)
    return f'{salt}${dk.hex()}'


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, dk_hex = stored.split('$', 1)
        dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100_000)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


# ── DB Table Setup ────────────────────────────────────

def _ensure_auth_tables():
    """Create users and organizations tables if they don't exist."""
    try:
        conn = connect_db()
        is_sqlite = getattr(conn, '_is_sqlite', False)
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS organizations (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    settings TEXT DEFAULT '{}',
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    org_id TEXT REFERENCES organizations(id),
                    role TEXT DEFAULT 'user',
                    display_name TEXT DEFAULT '',
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)
        else:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS organizations (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    settings JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT now()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    org_id TEXT REFERENCES organizations(id),
                    role TEXT DEFAULT 'user',
                    display_name TEXT DEFAULT '',
                    created_at TIMESTAMPTZ DEFAULT now()
                )
            """)
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        logger.exception('Failed to create auth tables')


_ensure_auth_tables()


# ── Request Models ────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str  # max 254 chars (RFC 5321)
    password: str  # min 6, max 128
    org_name: str = ''  # max 100
    display_name: str = ''  # max 100


class LoginRequest(BaseModel):
    email: str
    password: str  # max 128


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Auth Dependency ───────────────────────────────────

def get_current_user(request: Request) -> dict:
    """FastAPI dependency: extract and verify JWT from Authorization header.
    Returns the JWT payload dict with user_id, email, org_id, role."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='認証が必要です。')
    token = auth_header[7:]
    payload = _jwt_verify(token)
    if not payload:
        raise HTTPException(status_code=401, detail='トークンが無効または期限切れです。')
    return payload


def optional_current_user(request: Request) -> Optional[dict]:
    """Same as get_current_user but returns None instead of raising 401."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header[7:]
    return _jwt_verify(token)


# ── Endpoints ─────────────────────────────────────────

@router.post('/register')
def register(req: RegisterRequest = Body(...)):
    """新規ユーザー登録。組織も同時に作成。"""
    if not req.email or not req.password:
        raise HTTPException(400, 'メールアドレスとパスワードは必須です。')
    if len(req.email) > 254:
        raise HTTPException(400, 'メールアドレスが長すぎます。')
    if len(req.password) < 6:
        raise HTTPException(400, 'パスワードは6文字以上で入力してください。')
    if len(req.password) > 128:
        raise HTTPException(400, 'パスワードが長すぎます。')
    if len(req.org_name) > 100:
        raise HTTPException(400, '組織名が長すぎます。')
    if len(req.display_name) > 100:
        raise HTTPException(400, '表示名が長すぎます。')

    import uuid
    user_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())
    org_name = req.org_name.strip() or req.email.split('@')[0]

    try:
        conn = connect_db()
        cur = conn.cursor()

        # Check email uniqueness
        cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
        if cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(409, 'このメールアドレスは既に登録されています。')

        # Create org
        cur.execute(
            "INSERT INTO organizations (id, name) VALUES (%s, %s)",
            (org_id, org_name),
        )

        # Create user
        password_hash = _hash_password(req.password)
        cur.execute(
            "INSERT INTO users (id, email, password_hash, org_id, role, display_name) VALUES (%s, %s, %s, %s, %s, %s)",
            (user_id, req.email, password_hash, org_id, 'admin', req.display_name or org_name),
        )
        conn.commit()
        cur.close()
        conn.close()
    except HTTPException:
        raise
    except Exception:
        logger.exception('Registration failed')
        raise HTTPException(500, '登録に失敗しました。')

    # Issue tokens
    token_payload = {'user_id': user_id, 'email': req.email, 'org_id': org_id, 'role': 'admin'}
    access_token = _jwt_sign(token_payload, expiry=JWT_ACCESS_EXPIRY)
    refresh_token = _jwt_sign({**token_payload, 'type': 'refresh'}, expiry=JWT_REFRESH_EXPIRY)

    return JSONResponse({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': {
            'id': user_id,
            'email': req.email,
            'org_id': org_id,
            'org_name': org_name,
            'role': 'admin',
            'display_name': req.display_name or org_name,
        },
    })


@router.post('/login')
def login(req: LoginRequest = Body(...)):
    """ログイン → JWT トークン発行。"""
    try:
        conn = connect_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.email, u.password_hash, u.org_id, u.role, u.display_name, o.name as org_name
            FROM users u
            LEFT JOIN organizations o ON u.org_id = o.id
            WHERE u.email = %s
        """, (req.email,))
        row = cur.fetchone()
        cur.close()
        conn.close()
    except Exception:
        logger.exception('Login query failed')
        raise HTTPException(500, 'ログインに失敗しました。')

    if not row:
        raise HTTPException(401, 'メールアドレスまたはパスワードが正しくありません。')

    user_id, email, password_hash, org_id, role, display_name, org_name = (
        row[0], row[1], row[2], row[3], row[4], row[5], row[6] if len(row) > 6 else ''
    )

    if not _verify_password(req.password, password_hash):
        raise HTTPException(401, 'メールアドレスまたはパスワードが正しくありません。')

    token_payload = {'user_id': user_id, 'email': email, 'org_id': org_id, 'role': role}
    access_token = _jwt_sign(token_payload, expiry=JWT_ACCESS_EXPIRY)
    refresh_token = _jwt_sign({**token_payload, 'type': 'refresh'}, expiry=JWT_REFRESH_EXPIRY)

    return JSONResponse({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': {
            'id': user_id,
            'email': email,
            'org_id': org_id,
            'org_name': org_name or '',
            'role': role,
            'display_name': display_name or '',
        },
    })


@router.post('/refresh')
def refresh(req: RefreshRequest = Body(...)):
    """リフレッシュトークンで新しいアクセストークンを発行。"""
    payload = _jwt_verify(req.refresh_token)
    if not payload or payload.get('type') != 'refresh':
        raise HTTPException(401, 'リフレッシュトークンが無効または期限切れです。')

    token_payload = {
        'user_id': payload['user_id'],
        'email': payload['email'],
        'org_id': payload['org_id'],
        'role': payload['role'],
    }
    access_token = _jwt_sign(token_payload, expiry=JWT_ACCESS_EXPIRY)

    return JSONResponse({'access_token': access_token})


@router.get('/me')
def get_me(user: dict = Depends(get_current_user)):
    """現在のユーザー情報を取得。"""
    try:
        conn = connect_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.email, u.org_id, u.role, u.display_name, o.name as org_name
            FROM users u
            LEFT JOIN organizations o ON u.org_id = o.id
            WHERE u.id = %s
        """, (user['user_id'],))
        row = cur.fetchone()
        cur.close()
        conn.close()
    except Exception:
        logger.exception('Get me query failed')
        raise HTTPException(500, 'ユーザー情報の取得に失敗しました。')

    if not row:
        raise HTTPException(404, 'ユーザーが見つかりません。')

    return JSONResponse({
        'user': {
            'id': row[0],
            'email': row[1],
            'org_id': row[2],
            'role': row[3],
            'display_name': row[4] or '',
            'org_name': row[5] if len(row) > 5 else '',
        },
    })


# ── パスワード再認証（本人確認） ──────────────────────────

class VerifyPasswordRequest(BaseModel):
    password: str


@router.post('/verify_password')
def verify_password(req: VerifyPasswordRequest = Body(...), user: dict = Depends(get_current_user)):
    """AI自動生成の実行前にアカウントパスワードで本人確認する。
    JWT Bearer トークン + パスワードの二重認証。"""
    if not req.password:
        raise HTTPException(400, 'パスワードを入力してください。')

    try:
        conn = connect_db()
        cur = conn.cursor()
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (user['user_id'],))
        row = cur.fetchone()
        cur.close()
        conn.close()
    except Exception:
        logger.exception('Verify password query failed')
        raise HTTPException(500, 'パスワード確認に失敗しました。')

    if not row:
        raise HTTPException(404, 'ユーザーが見つかりません。')

    if not _verify_password(req.password, row[0]):
        raise HTTPException(403, 'パスワードが正しくありません。')

    return JSONResponse({'valid': True})
