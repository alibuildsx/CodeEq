export interface GitHubRepoIdentity {
  owner: string;
  repo: string;
}

export interface GitHubRepoMetadata {
  owner: string;
  name: string;
  defaultBranch: string;
  sizeKb: number;
  isPrivate: boolean;
}
