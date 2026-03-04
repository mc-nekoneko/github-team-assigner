export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET: string;
  /** 対象の GitHub Organization 名 */
  GITHUB_ORG: string;
  /**
   * チーム付与ルール (JSON 配列)
   *
   * 各ルールは条件 (if) と付与するチーム (assign) のセット。
   * 条件は以下のいずれか:
   *   - creatorIs: リポジトリ作成者のユーザー名に一致する場合 (ワイルドカード * 対応)
   *   - memberOf:  作成者が指定チームのメンバーである場合
   *
   * 例:
   * [
   *   { "if": { "creatorIs": "figma[bot]" }, "assign": [{ "slug": "designer", "permission": "push" }] },
   *   { "if": { "memberOf": "designer" },    "assign": [{ "slug": "designer", "permission": "push" }] },
   *   { "if": { "memberOf": "system" },      "assign": [{ "slug": "system",   "permission": "push" }] }
   * ]
   */
  TEAM_CONFIG: string;
}

export type Permission = "pull" | "push" | "admin" | "maintain" | "triage";

export interface TeamAssignment {
  slug: string;
  permission: Permission;
}

export interface RuleCondition {
  /** 作成者のユーザー名と一致する場合にマッチ。"*" をワイルドカードとして使用可能 (例: "*[bot]") */
  creatorIs?: string;
  /** 作成者が指定チームのメンバーである場合にマッチ */
  memberOf?: string;
}

export interface Rule {
  if: RuleCondition;
  assign: TeamAssignment[];
}

export function parseRules(raw: string): Rule[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("TEAM_CONFIG must be a JSON array");
    return parsed as Rule[];
  } catch (e) {
    console.error("Failed to parse TEAM_CONFIG:", e);
    return [];
  }
}

/**
 * ユーザー名がパターンに一致するか判定する
 * - "*[bot]" → 末尾が "[bot]" ならマッチ
 * - "figma*" → 先頭が "figma" ならマッチ
 * - "*"      → 全てマッチ
 * - その他   → 完全一致（大文字小文字無視）
 */
export function matchesPattern(username: string, pattern: string): boolean {
  if (pattern === "*") return true;
  const lower = username.toLowerCase();
  const pat = pattern.toLowerCase();
  if (pat.startsWith("*") && pat.endsWith("*")) {
    return lower.includes(pat.slice(1, -1));
  }
  if (pat.startsWith("*")) return lower.endsWith(pat.slice(1));
  if (pat.endsWith("*")) return lower.startsWith(pat.slice(0, -1));
  return lower === pat;
}
