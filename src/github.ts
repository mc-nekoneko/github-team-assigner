/**
 * GitHub API クライアント
 */
export class GitHubClient {
  private token: string;
  private baseUrl = "https://api.github.com";

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${text}`);
    }

    // 204 No Content
    if (res.status === 204) return {} as T;

    return res.json() as Promise<T>;
  }

  /**
   * ユーザーが org 内で所属しているチームを取得
   */
  async getUserTeamsInOrg(org: string, username: string): Promise<string[]> {
    try {
      const teams = await this.request<Array<{ slug: string }>>(`/orgs/${org}/teams?per_page=100`);

      const memberChecks = await Promise.all(
        teams.map(async (team) => {
          try {
            await this.request(`/orgs/${org}/teams/${team.slug}/memberships/${username}`);
            return team.slug;
          } catch {
            return null;
          }
        }),
      );

      return memberChecks.filter((slug): slug is string => slug !== null);
    } catch (e) {
      console.error(`Failed to get teams for ${username}:`, e);
      return [];
    }
  }

  /**
   * チームにリポジトリへのアクセスを付与
   */
  async addTeamToRepo(
    org: string,
    teamSlug: string,
    repoName: string,
    permission: "pull" | "push" | "admin" | "maintain" | "triage",
  ): Promise<void> {
    await this.request(`/orgs/${org}/teams/${teamSlug}/repos/${org}/${repoName}`, {
      method: "PUT",
      body: JSON.stringify({ permission }),
    });
  }
}
