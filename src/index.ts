import { Hono } from "hono";
import { GitHubClient } from "./github";
import { type Env, matchesPattern, type Permission, parseRules } from "./types";
import { verifyWebhookSignature } from "./webhook";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  return c.json({ status: "ok", service: "github-team-assigner" });
});

app.post("/webhook", async (c) => {
  const signature = c.req.header("X-Hub-Signature-256") ?? null;
  const event = c.req.header("X-GitHub-Event");
  const body = await c.req.text();

  // 署名検証
  const isValid = await verifyWebhookSignature(body, signature, c.env.GITHUB_WEBHOOK_SECRET);
  if (!isValid) {
    console.warn("Invalid webhook signature");
    return c.json({ error: "Invalid signature" }, 403);
  }

  // repository イベント以外は無視
  if (event !== "repository") {
    return c.json({ status: "ignored", event });
  }

  let payload: {
    action: string;
    repository: { name: string; full_name: string };
    sender: { login: string };
    organization?: { login: string };
  };

  try {
    payload = JSON.parse(body);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // created イベント以外は無視
  if (payload.action !== "created") {
    return c.json({ status: "ignored", action: payload.action });
  }

  const org = c.env.GITHUB_ORG;
  const rules = parseRules(c.env.TEAM_CONFIG);

  if (!org) {
    console.error("GITHUB_ORG is not configured");
    return c.json({ error: "GITHUB_ORG not configured" }, 500);
  }

  if (rules.length === 0) {
    console.error("TEAM_CONFIG is empty or invalid");
    return c.json({ error: "TEAM_CONFIG not configured" }, 500);
  }

  const { repository, sender } = payload;
  const repoName = repository.name;
  const creator = sender.login;

  console.log(`New repo created: ${repository.full_name} by ${creator}`);

  const github = new GitHubClient(c.env.GITHUB_TOKEN);

  // memberOf 条件があるルールが1つでもあればチームメンバーシップを取得する
  const needsMemberCheck = rules.some((r) => r.if.memberOf !== undefined);
  let userTeams: string[] = [];

  if (needsMemberCheck) {
    try {
      userTeams = await github.getUserTeamsInOrg(org, creator);
      console.log(`${creator} belongs to teams: ${userTeams.join(", ") || "none"}`);
    } catch (e) {
      // Bot など org メンバー以外の場合は空配列として扱い処理を続行
      console.warn(
        `Could not fetch team membership for ${creator} (may be a bot or external user):`,
        e,
      );
    }
  }

  // ルールを評価してチーム付与の一覧を構築（同一チームは後のルールで上書き）
  const assignmentsMap = new Map<string, Permission>();

  for (const rule of rules) {
    let matches = false;

    if (rule.if.creatorIs !== undefined) {
      matches = matchesPattern(creator, rule.if.creatorIs);
    } else if (rule.if.memberOf !== undefined) {
      matches = userTeams.includes(rule.if.memberOf);
    }

    if (matches) {
      console.log(`Rule matched for ${creator}:`, rule.if);
      for (const assignment of rule.assign) {
        assignmentsMap.set(assignment.slug, assignment.permission);
      }
    }
  }

  if (assignmentsMap.size === 0) {
    console.log(`No matching rules for ${creator}, skipping team assignment`);
    return c.json({ status: "ok", repo: repository.full_name, creator, teams: [] });
  }

  // マッチしたチームを付与
  const results: Array<{ team: string; status: "added" | "error"; error?: string }> = [];

  for (const [slug, permission] of assignmentsMap) {
    try {
      await github.addTeamToRepo(org, slug, repoName, permission);
      console.log(`Added team ${slug} to ${repoName} with ${permission} permission`);
      results.push({ team: slug, status: "added" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Failed to add team ${slug} to ${repoName}:`, e);
      results.push({ team: slug, status: "error", error: msg });
    }
  }

  const hasError = results.some((r) => r.status === "error");
  return c.json(
    {
      status: hasError ? "partial_error" : "ok",
      repo: repository.full_name,
      creator,
      teams: results,
    },
    hasError ? 500 : 200,
  );
});

export default app;
