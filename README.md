# ExamGen RAG — ローカル起動 & デプロイ手順

このリポジトリは RAG（Retrieval-Augmented Generation）を用いて試験問題用のプロンプトを生成する開発向けツールです。

重要: フロントエンドは「LLM に渡すプロンプト」を生成します。LLM の呼び出しは行いません。

## アーキテクチャ

| レイヤー | ローカル | 本番 |
|---|---|---|
| Frontend | Next.js (localhost:3000) | **Vercel** |
| Backend | FastAPI (localhost:8000) | **Render** (Web Service) |
| Database | SQLite (./data/examgen.db) | **Neon** (PostgreSQL) |

---

## 前提
- Python 3.11+（バックエンド）
- Node.js 18/20（フロントエンド）
- npm

---

## ローカル開発

### 1) バックエンド (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# DB マイグレーション（SQLite）
cd ..  # リポジトリルートへ
alembic upgrade head

# 開発サーバ起動
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2) フロントエンド (Next.js)

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

`next.config.js` の rewrites で `/api/*` が `http://localhost:8000/api/*` にプロキシされます。

### ローカル用 .env（任意）

リポジトリルートに `.env` を作成（`.env.example` を参照）。
`DATABASE_URL` を設定しなければ自動で `./data/examgen.db` (SQLite) が使われます。

---

## 本番デプロイ

### Step 1: Neon (PostgreSQL) セットアップ

1. [Neon Console](https://console.neon.tech/) でプロジェクトを作成
2. 接続文字列を取得（形式: `postgresql://user:pass@ep-xxx.region.neon.tech/dbname?sslmode=require`）
3. マイグレーション実行:

```bash
# ローカルから実行（DATABASE_URL に Neon の接続文字列を設定）
DATABASE_URL="postgresql://..." alembic upgrade head
```

### Step 2: Render (Backend) デプロイ

1. [Render Dashboard](https://dashboard.render.com/) で **New Web Service** を作成
2. リポジトリを接続し、以下を設定:

| 設定項目 | 値 |
|---|---|
| **Root Directory** | `backend` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `alembic -c ../alembic.ini upgrade head && gunicorn main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 120` |
| **Health Check Path** | `/health` |

3. 環境変数を設定:

| 変数名 | 値 |
|---|---|
| `DATABASE_URL` | Neon の接続文字列 |
| `CORS_ALLOW_ORIGINS` | `https://your-app.vercel.app,http://localhost:3000` |
| `PYTHON_VERSION` | `3.11.9` |

> **Tips**: `render.yaml` (Blueprint) もリポジトリに含まれています。Render の Blueprint 機能でインポートすると上記設定が自動適用されます。

### Step 3: Vercel (Frontend) デプロイ

1. [Vercel Dashboard](https://vercel.com/) で **Import Project** → リポジトリを選択
2. 以下を設定:

| 設定項目 | 値 |
|---|---|
| **Root Directory** | `apps/web` |
| **Framework** | Next.js (自動検出) |

3. 環境変数を設定:

| 変数名 | 値 |
|---|---|
| `API_BASE_URL` | Render の URL（例: `https://examgen-backend.onrender.com`） |

これにより、Next.js の SSR rewrites が `/api/*` を Render のバックエンドへプロキシします。

---

## 環境変数一覧

| 変数名 | 設置場所 | 説明 | デフォルト |
|---|---|---|---|
| `DATABASE_URL` | Render | Neon PostgreSQL 接続文字列 | SQLite (`./data/examgen.db`) |
| `CORS_ALLOW_ORIGINS` | Render | カンマ区切りの許可オリジン | `*` |
| `API_BASE_URL` | Vercel | Backend URL (SSR rewrites 用) | `http://localhost:8000` |
| `NEXT_PUBLIC_API_BASE` | Vercel (任意) | ブラウザ直接呼出し用 | `''` (空 = rewrites 経由) |
| `PYTHON_VERSION` | Render | Python バージョン | `3.11.9` |

---

## マイグレーション

```bash
# 新しいマイグレーションを作成
alembic revision --autogenerate -m "description"

# マイグレーション適用
alembic upgrade head

# 状態確認
alembic current
alembic history
```

Render デプロイ時は Start Command 内で `alembic upgrade head` が毎回実行されます（冪等）。

---

## ヘルスチェック

```bash
# Backend
curl https://examgen-backend.onrender.com/health
# → {"status":"ok"}

# Frontend
curl -I https://your-app.vercel.app/
```

---

## トラブルシュート

- **Backend が起動しない**: `DATABASE_URL` の形式を確認（`postgres://` ではなく `postgresql://` を使用）。Neon は `?sslmode=require` が必要ですが、`db.py` が自動付与します。
- **CORS エラー**: Render の `CORS_ALLOW_ORIGINS` に Vercel のドメインが含まれているか確認。
- **マイグレーションエラー**: `alembic current` で現在の状態を確認し、`alembic upgrade head` を再実行。
- **Frontend が API を呼べない**: Vercel の `API_BASE_URL` が正しい Render URL を指しているか確認。

---

