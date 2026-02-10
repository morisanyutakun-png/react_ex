# ExamGen RAG — ローカル起動手順（Next.js + FastAPI）

このリポジトリは RAG（Retrieval-Augmented Generation）を用いて試験問題用のプロンプトを生成する開発向けツールです。

重要: フロントエンドは「LLM に渡すプロンプト」を生成します。LLM の呼び出しは行いません。

## 前提
- Python 3.11+（バックエンド）
- Node.js 18/20（フロントエンド）
- npm または pnpm

## 1) バックエンド (FastAPI)

```bash
cd /Users/moriyuuta/react_ex/backend
# 仮想環境を作る（まだなら）
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# 開発サーバ起動
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 2) フロントエンド (Next.js)

```bash
cd /Users/moriyuuta/react_ex/apps/web
# 依存を初回インストール（まだなら）
npm install
# 開発サーバ起動（http://localhost:3000）
npm run dev
```

## 本番ビルド / Docker（任意）

```bash
cd /Users/moriyuuta/react_ex/apps/web
npm run build
npm start
```

Docker イメージを作る場合:

```bash
cd /Users/moriyuuta/react_ex/apps/web
docker build -t examgen-web .
docker run -p 3000:3000 examgen-web
```

## ヘルスチェック

```bash
curl -I http://localhost:3000/
curl -I http://localhost:8000/api/templates
```

## 補足
- `next.config.js` で `/api/*` を `http://localhost:8000/api/*` にリライトしています。バックエンドが起動している必要があります。
- フロントはプロンプト生成が主目的です。生成したプロンプトを外部の LLM（例: ChatGPT）に手動で与えてください。

## トラブルシュート
- バックエンドが起動しない場合は仮想環境が有効か、`requirements.txt` のインストールに成功しているか、ポート 8000 が空いているか確認してください。
- フロントが動かない場合は Node/npm のバージョン確認と `npm install` の再実行を試してください。

---
(この README は Next.js を前提とした起動手順の簡潔版です)
