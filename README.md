# github-team-assigner

GitHub Organization で新しいリポジトリが作成された時に、作成者のチーム所属に応じて自動的にチームを付与する Cloudflare Worker。

## 動作

1. GitHub から `repository.created` Webhook を受信
2. 作成者が設定されたチームのメンバーかどうかを確認
3. メンバーであれば、そのチームをリポジトリに自動付与

## 環境変数

| 変数名 | 種類 | 説明 |
|--------|------|------|
| `GITHUB_TOKEN` | Secret | GitHub PAT（`admin:org` + `repo` スコープ） |
| `GITHUB_WEBHOOK_SECRET` | Secret | Webhook 署名検証用シークレット |
| `GITHUB_ORG` | Variable | 対象の Organization 名（例: `TSUQREA`） |
| `TEAM_CONFIG` | Variable | チーム設定 JSON（下記参照） |

### TEAM_CONFIG の形式

```json
[
  {"slug": "designer", "permission": "push"},
  {"slug": "system", "permission": "push"}
]
```

`permission` は `pull` / `push` / `admin` / `maintain` / `triage` から選択。

## セットアップ

### 1. シークレット・変数の設定

```bash
# シークレット
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_WEBHOOK_SECRET

# 変数（wrangler.toml に直接書くか、ダッシュボードで設定）
# wrangler.toml に追記する場合:
# [vars]
# GITHUB_ORG = "TSUQREA"
# TEAM_CONFIG = '[{"slug":"designer","permission":"push"},{"slug":"system","permission":"push"}]'
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

## 別の Organization で使う場合

環境変数を変えるだけで任意の org に対応:

```bash
# 例: my-company org で engineering と design チームを自動付与
GITHUB_ORG=my-company
TEAM_CONFIG='[{"slug":"engineering","permission":"push"},{"slug":"design","permission":"pull"}]'
```
