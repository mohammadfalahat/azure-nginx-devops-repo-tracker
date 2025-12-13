# Azure Nginx DevOps Repo Tracker

A lightweight Azure DevOps watcher that tracks `main` on every project repository named `{ProjectNameWithoutSpaces}_Nginx_DevOps`. When a new commit lands on `main`, it inspects environment configuration files (e.g., `demo.conf`, `qa.conf`, `test.conf`) and triggers a Komodo GitOps webhook with the matching environment identifiers (`{ProjectNameWithoutSpaces}_Nginx_DevOps_{environment}`).

## How it works
1. Discovers all projects in your Azure DevOps organization.
2. Computes the sanitized project name (removes spaces) and looks for a repository named `{Sanitized}_Nginx_DevOps` in each project.
3. Checks the latest commit on `main` and compares it with the stored state file (`data/state.json` by default).
4. Reads `.conf` files at the repo root to derive environments (e.g., `demo.conf` → `demo`). Environment names are lowercased so `Demo.conf`, `DEMO.conf`, or `demo.conf` all become `demo`.
5. Calculates which `.conf` files changed in the new commit and only triggers Komodo for those environments (skipping webhook calls if no environment files changed).
6. Calls the Komodo webhook with project/repo metadata, the new commit ID, all detected environments, the changed environments, and the fully formatted Komodo environment keys.
7. Persists the newest processed commit to avoid duplicate notifications.
8. Appends each run (including skipped webhook scenarios) to a JSON run log so you can surface per-project history alongside your Pipelines menu.

## Prerequisites
- Node.js 18+
- Azure DevOps PAT with access to read projects and Git repositories.
- Komodo GitOps webhook URL.
- `KOMODO_API_KEY`: Komodo API key sent as `X-Api-Key`.
- `KOMODO_API_SECRET`: Komodo API secret sent as `X-Api-Secret`.

## Configuration
Set the following environment variables:

- `AZDO_ORG_URL`: Azure DevOps organization URL (e.g., `https://dev.azure.com/contoso`).
- `AZDO_PAT`: Personal Access Token.
- `KOMODO_WEBHOOK_URL`: Komodo GitOps webhook endpoint to notify.
- `STATE_FILE` (optional): Path to the tracker state file. Defaults to `data/state.json`.
- `RUN_LOG_FILE` (optional): Path to the run history JSON written on every run. Defaults to `data/run-log.json`.

## Installation & usage
```bash
npm install
npm run build

# Run once (reads env vars above)
npm start

# Or run in watch mode while developing
npm run dev
```

Schedule the tracker (e.g., with cron or a pipeline task) to poll on your cadence. Each successful run updates the state file to prevent duplicate webhook calls for the same commit.

### Viewing run history next to Pipelines
- Each tracker run appends a record to `RUN_LOG_FILE` with the project, repo, branch, commit ID, detected environments, changed environments, webhook decision, and a short message.
- You can surface this log in an Azure DevOps extension tab or menu entry that sits next to the Pipelines hub by reading the JSON and rendering the entries per project.
- Example shape:

```json
{
  "runs": [
    {
      "timestamp": "2024-05-15T12:00:00.000Z",
      "project": "Project Name",
      "repo": "ProjectName_Nginx_DevOps",
      "branch": "main",
      "commitId": "<commit SHA>",
      "environments": ["demo", "qa", "test"],
      "changedEnvironments": ["demo"],
      "komodoEnvironments": ["ProjectName_Nginx_DevOps_demo"],
      "webhookTriggered": true,
      "message": "Webhook triggered for changed environment files"
    }
  ]
}
```

## Payload sent to Komodo
The webhook payload includes (only sent when one or more environment `.conf` files change):

```json
{
  "project": "Project Name",
  "repo": "ProjectName_Nginx_DevOps",
  "branch": "main",
  "commitId": "<commit SHA>",
  "environments": ["demo", "qa", "test"],
  "changedEnvironments": ["demo"],
  "komodoEnvironments": [
    "ProjectName_Nginx_DevOps_demo"
  ]
}
```

## Notes
- The tracker only inspects `.conf` files at the repository root. Add environment files such as `demo.conf`, `qa.conf`, `test.conf`, or any other `<environment>.conf` to participate in Komodo updates. File names are normalized to lowercase environment identifiers when building webhook payloads.
- The state file is updated after every processed repository. Delete it if you need to replay notifications.
