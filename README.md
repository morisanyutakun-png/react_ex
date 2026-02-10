# RAG LaTeX/JSON MVP (React + FastAPI)

このリポジトリは「教材の標準化と安全な RAG ワークフロー」を目的とするサンプルです。
主な方針: PDF ではなく LaTeX / JSON を一次データ形式とし、生成 → プレビュー → 登録 の流れで教材を管理します。

目標 (MVP):
- フロント: Vite + React
- バック: FastAPI
- 機能: LaTeX/JSON 登録、LaTeX プレビュー（KaTeX/pandoc）、チャンク化、TF-IDF 検索、RAG 用インデックス

構成 (最小):
- backend/
  - requirements.txt
  - rag.py
  - main.py
- frontend/
  - index.html
  - vite.config.js
  - src/
    - main.jsx
    - App.jsx

---

起動手順（mac / zsh の例）



1) バックエンド
```bash
cd /Users/moriyuuta/react_ex/backend
chmod +x start_backend_safe.sh
./start_backend_safe.sh
```


2) フロントエンド（Vite）

> 推奨：Node.js 20.x（LTS）

```bash
フロント起動（推奨: Node.js 20.x）

"""
./start_frontend_safe.sh --start
"""

Default:
```bash
cd /Users/moriyuuta/react_ex/frontend
chmod +x start_frontend_safe.sh
./start_frontend_safe.sh
```

Recovery:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --omit=optional
npm run dev
```

pnpm alternative:
```bash
cd frontend
corepack enable && pnpm install
npm run dev
```

Open: http://localhost:5173
```

### 起動できないとき（Vite/Rollup関連）

Retry steps:

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --omit=optional
npm run dev
```

pnpm alternative:

```bash
corepack enable && pnpm install
npm run dev
```

If macOS blocks native modules:

```bash
xattr -dr com.apple.quarantine node_modules/@rollup node_modules/rollup 2>/dev/null || true
```


使い方（ブラウザ）:
- PDF を選んで Upload。
- 表示された `doc_id` を元に質問を入力して Ask。
- Answer と Top contexts が表示されます。

Ollama 連携（任意）:
- 環境変数 `OLLAMA_URL` を指定すると（例: `http://localhost:11434`）、上位チャンクをプロンプトにして Ollama を呼び出します。
- モデル名を `OLLAMA_MODEL` に設定できます（省略時は `llama3`）。
- Ollama がなければ、上位チャンクを連結したものを暫定回答として返します。

注意点:
- 開発では Vite の proxy を使って `/api` を backend に転送しています（CORS を避けるため）。
- 本番ではフロントをビルドして静的配信するか、リバースプロキシ（NGINX等）を検討してください。

依存 (backend/requirements.txt にも記載):
- fastapi, uvicorn, python-multipart, pypdf, scikit-learn, numpy, requests


これでまず動く最小実装ができています。以下はローカル開発を簡単にする `docker-compose` と `scripts/dev.sh` を使った Quickstart です。

Quickstart (docker / 一括起動)

1) 環境変数ファイルを作成（例として .env.example を参照）:

```bash
cp .env.example .env
```

2) サービスを起動:

```bash
./scripts/dev.sh up
```




3) ログ確認:

```bash
./scripts/dev.sh logs backend
./scripts/dev.sh logs db
```

4) 停止:

```bash
./scripts/dev.sh down
```

5) リセット（ボリューム削除を含む）:

```bash
./scripts/dev.sh reset
```

説明:
- `backend` コンテナは `/app` にソースをマウントして開発可能にしています。
- マイグレーション SQL は `backend/db/migrations/` に配置され、`postgres` の初回起動時に実行されます（`/docker-entrypoint-initdb.d` を利用）。

次に進める提案:
- `workers/ingest/pipeline/segmenter.py` の実装（問題単位分割ルール） → まずは小さなテキストファイルで動作確認しましょう。
- あるいは DB スキーマを確認してから `backend/embeddings.py` を実装する流れもおすすめです。

SQLite 開発モード（Postgres が無くても動かす）

ローカルで Postgres を用意せずに開発したい場合、デフォルトで SQLite を使うようにしています。手順:

1) `DATABASE_URL` を未設定にしておく（デフォルトで sqlite:///./data/examgen.db を使用）
2) Alembic を使ってマイグレーションを適用（`./data` がなければ自動作成されます）

```bash
# 仮想環境を有効化して依存を入れる
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt alembic

# データディレクトリと DB を作成し、マイグレーションを実行
alembic upgrade head

# 起動
uvicorn backend.main:app --reload --port 8000
```

注意:
- `alembic` はリポジトリの `alembic.ini` を参照し、環境変数 `DATABASE_URL` を優先します（未設定時は `sqlite:///./data/examgen.db` を使用）。
- SQLite は Postgres 固有の拡張（vector, pg_trgm, JSONB）を持ちません。開発用に互換性のある簡易スキーマを Alembic のマイグレーションで作成します。


---

管理ダッシュボード（Admin UI）

- 起動前に管理トークン（共有シークレット）を設定します（推奨）:

```bash
# 開発環境での例（unix系シェル）
export ADMIN_SECRET="$(openssl rand -hex 16)"
```

- 開発時の利便性オプション（安全ではありません; ローカル開発専用）:
  - `ALLOW_DEV_ADMIN=1` を設定すると、起動時に自動で開発用トークンを生成します。
  - ローカルから `GET /api/admin/dev-token` を呼ぶと生成トークンを取得できます（`curl http://localhost:8000/api/admin/dev-token`）

- トークンの使い方（アクセス方法）:
  - ブラウザ: `http://localhost:8000/admin?admin_token=あなたのトークン`
  - curl / スクリプト: `curl -H "x-admin-token: あなたのトークン" http://localhost:8000/api/admin/status`

- ダッシュボードで確認できること:
  - 総問題数、各種埋め込みの件数、足りない埋め込みの件数
  - 最新の問題のスニペット（デバッグ用）
  - ボタンで「難易度再計算」や「不足埋め込みの生成」を実行できます（ジョブはバックグラウンドで実行されます）

- セキュリティ注意（重要）:
  - この仕組みは**開発用の簡易認証**です。本番運用では HTTPS を必須にし、トークン管理を厳格に行い、可能なら JWT/OAuth などの適切な認可方式に置き換えてください。
  - トークンは長くランダムにし、共有範囲を限定してください。

### 評価 (RAG)

- 小規模な評価を自動化するスクリプトを追加しました: `backend/scripts/eval_rag.py`。
  - `--mode self_supervised` で簡易的に DB からクエリを採取して Precision@k / MRR / NDCG を算出します。
  - `--mode file --evalfile path/to/file.json` でラベル付き評価データを使えます。
  - `--grid-search` で α/β/γ をグリッド探索（MRR を最大化）できます。

### ステム正規化

- 問題文 `stem` を人間向けに正規化する `backend/scripts/normalize_stems.py` を追加しました。
  - `--dry-run`（デフォルト）で提案を表示、`--apply` で `data/stem_normalization_backup.csv` にバックアップを作って DB を更新します。

