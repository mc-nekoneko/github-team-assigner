# github-team-assigner

GitHub Organization で新しいリポジトリが作成された時に、作成者（またはボット）に応じて自動的にチームを付与する Cloudflare Worker。

## 動作

1. GitHub から `repository.created` Webhook を受信
2. 設定されたルールに従い、作成者（ユーザー名またはチーム所属）を評価
3. マッチしたルールのチームをリポジトリに自動付与

## 環境変数

| 変数名 | 種類 | 説明 |
|--------|------|------|
| `GITHUB_TOKEN` | Secret | GitHub PAT（`admin:org` + `repo` スコープ） |
| `GITHUB_WEBHOOK_SECRET` | Secret | Webhook 署名検証用シークレット |
| `GITHUB_ORG` | Variable | 対象の Organization 名（例: `TSUQREA`） |
| `TEAM_CONFIG` | Variable | チーム付与ルール JSON（下記参照） |

### TEAM_CONFIG の形式

ルールの配列を JSON で指定する。各ルールは **条件 (`if`)** と **付与するチーム (`assign`)** のセット。

```json
[
  { "if": { "creatorIs": "figma[bot]" },  "assign": [{ "slug": "designer", "permission": "push" }] },
  { "if": { "memberOf": "designer" },     "assign": [{ "slug": "designer", "permission": "push" }] },
  { "if": { "memberOf": "system" },       "assign": [{ "slug": "system",   "permission": "push" }] }
]
```

#### 条件 (`if`) の種類

| 条件 | 説明 |
|------|------|
| `creatorIs` | 作成者のユーザー名と一致する場合にマッチ。ワイルドカード `*` 対応 |
| `memberOf` | 作成者が指定チームのメンバーである場合にマッチ |

**`creatorIs` のワイルドカード例:**

| パターン | マッチする例 |
|----------|------------|
| `figma[bot]` | `figma[bot]` のみ（完全一致） |
| `*[bot]` | `figma[bot]`, `github[bot]` など末尾が `[bot]` 全て |
| `figma*` | `figma[bot]`, `figmauser` など先頭が `figma` 全て |
| `*` | 全ユーザー |

#### 動作例

| 作成者 | マッチするルール | 付与されるチーム |
|--------|-----------------|-----------------|
| `figma[bot]` | `creatorIs: "figma[bot]"` | `designer` |
| デザイナーメンバー | `memberOf: "designer"` | `designer` |
| エンジニアメンバー | `memberOf: "system"` | `system` |
| 外部ユーザー | なし | なし（何も付与しない） |

`permission` は `pull` / `push` / `admin` / `maintain` / `triage` から選択。

## セットアップ

### 1. シークレット・変数の設定

```bash
# シークレット
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_WEBHOOK_SECRET

# wrangler.toml に vars を追記
# [vars]
# GITHUB_ORG = "TSUQREA"
# TEAM_CONFIG = '[{"if":{"creatorIs":"figma[bot]"},"assign":[{"slug":"designer","permission":"push"}]},{"if":{"memberOf":"designer"},"assign":[{"slug":"designer","permission":"push"}]},{"if":{"memberOf":"system"},"assign":[{"slug":"system","permission":"push"}]}]'
```

### 2. デプロイ

```bash
npm install
npm run deploy
```

### 3. GitHub Webhook の設定

1. `https://github.com/organizations/<ORG>/settings/hooks` を開く
2. **Add webhook** をクリック
3. 設定:
   - **Payload URL**: `https://github-team-assigner.<account>.workers.dev/webhook`
   - **Content type**: `application/json`
   - **Secret**: `GITHUB_WEBHOOK_SECRET` に設定した値
   - **Events**: `Let me select individual events` → `Repositories` にチェック
4. **Add webhook** で保存

### 4. GitHub Actions シークレット（CI/CD 用）

- `CLOUDFLARE_API_TOKEN`: Cloudflare API トークン（Workers 編集権限）
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare アカウント ID

## ローカル開発

```bash
cp .dev.vars.example .dev.vars
# 各変数を設定
npm run dev
```
