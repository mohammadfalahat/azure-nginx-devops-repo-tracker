import axios from "axios";
import * as azdev from "azure-devops-node-api";
import { GitRepository, VersionControlRecursionType } from "azure-devops-node-api/interfaces/GitInterfaces";
import { loadConfig } from "./config";
import { loadState, persistState, RepoState } from "./state";
import {
  detectEnvironments,
  detectEnvironmentsFromPaths,
  formatKomodoEnvironmentKeys,
  sanitizeProjectName,
} from "./naming";
import { appendRunLogEntry, RunLogEntry } from "./log";

async function main(): Promise<void> {
  const config = loadConfig();
  const state = loadState(config.stateFile);

  const authHandler = azdev.getPersonalAccessTokenHandler(config.personalAccessToken);
  const connection = new azdev.WebApi(config.organizationUrl, authHandler);

  const coreApi = await connection.getCoreApi();
  const gitApi = await connection.getGitApi();

  const projects = await coreApi.getProjects();
  if (!projects) {
    console.log("No projects found in the organization.");
    return;
  }

  for (const project of projects) {
    if (!project || !project.name || !project.id) continue;

    const sanitizedName = sanitizeProjectName(project.name);
    const targetRepoName = `${sanitizedName}_Nginx_DevOps`;

    const repositories = await gitApi.getRepositories(project.id);
    const repo = repositories?.find((r) => r.name === targetRepoName);

    if (!repo) {
      console.log(`Skipping project ${project.name}: repo ${targetRepoName} not found.`);
      continue;
    }

    await handleRepository(
      project.name,
      sanitizedName,
      repo,
      gitApi,
      state,
      config.komodoWebhookUrl,
      config.komodoApiKey,
      config.komodoApiSecret,
      config.runLogFile
    );
  }

  persistState(config.stateFile, state);
}

async function handleRepository(
  projectName: string,
  sanitizedName: string,
  repo: GitRepository,
  gitApi: azdev.IGitApi,
  state: RepoState,
  webhookUrl: string,
  komodoApiKey: string,
  komodoApiSecret: string,
  runLogFile: string
): Promise<void> {
  if (!repo.id || !repo.project?.id) return;

  const refs = await gitApi.getRefs(repo.id, repo.project.id, undefined, "heads/main");
  const mainRef = refs?.find((ref) => ref.name?.endsWith("refs/heads/main"));

  if (!mainRef?.objectId) {
    console.log(`Could not find main branch for ${repo.name}.`);
    return;
  }

  const previousCommit = state.repositories[repo.id]?.commitId;
  if (previousCommit === mainRef.objectId) {
    console.log(`No new commits on ${repo.name} (main).`);
    appendRunLogEntry(runLogFile, buildRunLogEntry(projectName, repo, mainRef.objectId, [], [], [], false, "No new commits"));
    return;
  }

  const items = await gitApi.getItems(
    repo.id,
    repo.project.id,
    undefined,
    VersionControlRecursionType.OneLevel,
    false,
    false,
    false,
    false
  );

  const environments = detectEnvironments(items || []);
  const changedEnvironments = await detectChangedEnvironments(gitApi, repo, mainRef.objectId);

  let webhookTriggered = false;
  let komodoEnvironments: string[] = [];

  if (changedEnvironments.length === 0) {
    console.log(
      `No environment .conf changes on ${repo.name}@main for commit ${mainRef.objectId}. Skipping Komodo webhook.`
    );
  } else {
    komodoEnvironments = formatKomodoEnvironmentKeys(sanitizedName, changedEnvironments);
    webhookTriggered = true;

    await triggerKomodoWebhook(webhookUrl, komodoApiKey, komodoApiSecret, {
      project: projectName,
      repo: repo.name,
      branch: "main",
      commitId: mainRef.objectId,
      environments,
      changedEnvironments,
      komodoEnvironments,
    });
  }

  state.repositories[repo.id] = {
    commitId: mainRef.objectId,
    repoName: repo.name || "",
    projectName,
  };

  console.log(
    `Processed ${repo.name}@main. New commit: ${mainRef.objectId}. Environments: ${environments.join(",")}. Changed: ${changedEnvironments.join(",")}`
  );

  appendRunLogEntry(
    runLogFile,
    buildRunLogEntry(
      projectName,
      repo,
      mainRef.objectId,
      environments,
      changedEnvironments,
      komodoEnvironments,
      webhookTriggered,
      webhookTriggered
        ? "Webhook triggered for changed environment files"
        : "Skipped webhook (no environment file changes)"
    )
  );
}

async function triggerKomodoWebhook(
  url: string,
  apiKey: string,
  apiSecret: string,
  payload: Record<string, unknown>
): Promise<void> {
  console.log(`Triggering Komodo webhook: ${url}`);

  try {
    await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        "X-Api-Secret": apiSecret,
      },
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText ?? "";
      const responseBody = stringifyResponseBody(error.response?.data);

      console.error(
        [
          "Komodo webhook request failed",
          status ? `status=${status}` : null,
          statusText ? `statusText=\"${statusText}\"` : null,
          responseBody ? `body=${responseBody}` : null,
        ]
          .filter(Boolean)
          .join(" ")
      );

      // Provide a hint for common 405 misconfiguration scenarios (e.g., hitting a POST-only endpoint with GET).
      if (status === 405) {
        console.error("The Komodo listener rejected the request (405). Ensure the webhook endpoint expects a POST request.");
      }
    }

    throw error;
  }
}

function stringifyResponseBody(body: unknown): string {
  if (body === undefined || body === null) {
    return "";
  }

  if (typeof body === "string") {
    return body;
  }

  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

async function detectChangedEnvironments(
  gitApi: azdev.IGitApi,
  repo: GitRepository,
  commitId: string
): Promise<string[]> {
  if (!repo.id || !repo.project?.id) return [];

  const changeList = await gitApi.getChanges(commitId, repo.id, repo.project.id);
  const paths = changeList.changes?.map((change) => change.item?.path || "").filter(Boolean) || [];

  return detectEnvironmentsFromPaths(paths);
}

function buildRunLogEntry(
  projectName: string,
  repo: GitRepository,
  commitId: string,
  environments: string[],
  changedEnvironments: string[],
  komodoEnvironments: string[],
  webhookTriggered: boolean,
  message: string
): RunLogEntry {
  return {
    timestamp: new Date().toISOString(),
    project: projectName,
    repo: repo.name || "",
    branch: "main",
    commitId,
    environments,
    changedEnvironments,
    komodoEnvironments,
    webhookTriggered,
    message,
  };
}

main().catch((error) => {
  console.error("Tracker failed", error);
  process.exit(1);
});
