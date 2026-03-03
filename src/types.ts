export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET: string;
}

export interface GitHubWebhookPayload {
  action: string;
  repository: {
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
  };
  sender: {
    login: string;
  };
  organization?: {
    login: string;
  };
}

export interface GitHubTeam {
  id: number;
  slug: string;
  name: string;
  permission: string;
}

// チーム設定
// TODO: 将来的に環境変数から読み込めるようにする
export const ORG = "TSUQREA";
export const TEAM_CONFIG = {
  designer: {
    slug: "designer",
    permission: "push" as const,
  },
  system: {
    slug: "system",
    permission: "push" as const,
  },
} as const;
