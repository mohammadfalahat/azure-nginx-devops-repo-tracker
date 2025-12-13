import * as fs from "fs";

export interface RepoRecord {
  commitId: string;
  repoName: string;
  projectName: string;
}

export interface RepoState {
  repositories: Record<string, RepoRecord>;
}

export function loadState(stateFile: string): RepoState {
  if (!fs.existsSync(stateFile)) {
    return { repositories: {} };
  }

  const content = fs.readFileSync(stateFile, "utf-8");
  return JSON.parse(content) as RepoState;
}

export function persistState(stateFile: string, state: RepoState): void {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}
