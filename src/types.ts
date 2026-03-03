export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET: string;
  /** 対象の GitHub Organization 名 */
  GITHUB_ORG: string;
  /**
   * 自動付与するチーム設定 (JSON)
   * 例: [{"slug":"designer","permission":"push"},{"slug":"system","permission":"push"}]
   */
  TEAM_CONFIG: string;
}

export type Permission = "pull" | "push" | "admin" | "maintain" | "triage";

export interface TeamConfig {
  slug: string;
  permission: Permission;
}

export function parseTeamConfig(raw: string): TeamConfig[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("TEAM_CONFIG must be a JSON array");
    return parsed.map((t: { slug?: string; permission?: string }) => ({
      slug: t.slug ?? "",
      permission: (t.permission ?? "push") as Permission,
    }));
  } catch (e) {
    console.error("Failed to parse TEAM_CONFIG:", e);
    return [];
  }
}
