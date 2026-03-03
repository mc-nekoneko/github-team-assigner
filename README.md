# github-team-assigner

TSUQREA org で新しいリポジトリが作成された時に、作成者のチーム所属に応じて自動的にチームを付与する Cloudflare Worker。

## 動作

1. GitHub から `repository.created` Webhook を受信
2. 作成者が `designer` チームのメンバー → `designer` チームを付与（push 権限）
3. 作成者が `system` チームのメンバー → `system` チームを付与（push 権限）
4. 両方のメンバーなら両方付与

## セットアップ

### 1. シークレットの設定

```bash
wrangler secret put GITHUB_TOKEN
# admin:org, repo スコープを持つ PAT を入力

wrangler secret put GITHUB_WEBHOOK_SECRET
# 任意のランダム文字列を入力（GitHub Webhook 設定時に使う）
```

### 2. デプロイ

```bash
npm install
npm run deploy
```

デプロイ後に表示される Worker URL をメモする（例: `https://github-team-assigner.<account>.workers.dev`）

### 3. GitHub Webhook の設定

1. `https://github.com/organizations/TSUQREA/settings/hooks` を開く
2. **Add webhook** をクリック
3. 設定:
   - **Payload URL**: `https://github-team-assigner.<account>.workers.dev/webhook`
   - **Content type**: `application/json`
   - **Secret**: `GITHUB_WEBHOOK_SECRET` に設定した値
   - **Events**: `Repositories` にチェック（Let me select individual events → Repositories）
4. **Add webhook** で保存

### 4. GitHub Actions シークレット（CI/CD 用）

リポジトリの Settings → Secrets に追加:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API トークン（Workers 編集権限）
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare アカウント ID

## ローカル開発

```bash
# .dev.vars ファイルを作成
cp .dev.vars.example .dev.vars
# GITHUB_TOKEN と GITHUB_WEBHOOK_SECRET を設定

npm run dev
```

## チーム設定の変更

`src/types.ts` の `TEAM_CONFIG` を編集:

```typescript
export const TEAM_CONFIG = {
  designer: {
    slug: "designer",  // GitHub チームのスラッグ
    permission: "push" as const,
  },
  system: {
    slug: "system",
    permission: "push" as const,
  },
};
```
