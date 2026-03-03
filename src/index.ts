import { Hono } from "hono";
import { GitHubClient } from "./github";
import { type Env, parseTeamConfig } from "./types";
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
  const teams = parseTeamConfig(c.env.TEAM_CONFIG);

  if (!org) {
    console.error("GITHUB_ORG is not configured");
    return c.json({ error: "GITHUB_ORG not configured" }, 500);
  }

  if (teams.length === 0) {
    console.error("TEAM_CONFIG is empty or invalid");
    return c.json({ error: "TEAM_CONFIG not configured" }, 500);
  }

  const { repository, sender } = payload;
  const repoName = repository.name;
  const creator = sender.login;

  console.log(`New repo created: ${repository.full_name} by ${creator}`);

  const github = new GitHubClient(c.env.GITHUB_TOKEN);

  // 作成者のチーム所属を確認
  let userTeams: string[];
  try {
    userTeams = await github.getUserTeamsInOrg(org, creator);
    console.log(`${creator} belongs to teams: ${userTeams.join(", ") || "none"}`);
  } catch (e) {
    console.error("Failed to get user teams:", e);
    return c.json({ error: "Failed to fetch team membership" }, 500);
  }

  const results: Array<{ team: string; status: "added" | "skipped" | "error"; error?: string }> =
    [];

  // チームを付与
  for (const config of teams) {
    if (!userTeams.includes(config.slug)) {
      results.push({ team: config.slug, status: "skipped" });
      continue;
    }

    try {
      await github.addTeamToRepo(org, config.slug, repoName, config.permission);
      console.log(`Added team ${config.slug} to ${repoName} with ${config.permission} permission`);
      results.push({ team: config.slug, status: "added" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Failed to add team ${config.slug} to ${repoName}:`, e);
      results.push({ team: config.slug, status: "error", error: msg });
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
