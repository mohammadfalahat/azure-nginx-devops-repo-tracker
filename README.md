# Azure Nginx DevOps Repo Tracker

A lightweight Node.js/TypeScript tracker that monitors `main` in Azure DevOps repositories named:

`{ProjectNameWithoutSpaces}_Nginx_DevOps`

When a new commit is detected, the tracker inspects environment config files (`*.conf`, for example `demo.conf`, `qa.conf`, `test.conf`) and triggers a Komodo GitOps webhook **only** for environments that changed in that commit.

---

## Features

- Discovers all projects in an Azure DevOps organization.
- Computes a sanitized project name (removes spaces) and finds the target repo.
- Tracks the last processed commit per repo to avoid duplicate notifications.
- Detects available environments from `*.conf` file names.
- Detects changed environments from commit changes.
- Sends Komodo webhook with metadata and environment keys.
- Writes run history to JSON (including skipped webhook scenarios).

---

## How it works

On each run, the tracker:

1. Loads configuration from environment variables.
2. Loads persisted state from `STATE_FILE`.
3. Lists Azure DevOps projects.
4. For each project, looks for `{SanitizedProjectName}_Nginx_DevOps`.
5. Reads `refs/heads/main`.
6. If commit is unchanged, logs a skipped run entry.
7. Detects all environments from repo `*.conf` files.
8. Detects changed environments from the latest commit change set.
9. Triggers Komodo webhook only when at least one environment file changed.
10. Persists updated state and appends run log entry.

---

## Prerequisites

- Node.js 18+
- Azure DevOps Personal Access Token (PAT) with project/repo read access
- Komodo webhook URL
- Komodo API key and secret

---

## Configuration

Set these environment variables:

| Variable | Required | Description |
|---|---|---|
| `AZDO_ORG_URL` | Yes | Azure DevOps org URL, e.g. `https://dev.azure.com/contoso` |
| `AZDO_PAT` | Yes | Azure DevOps Personal Access Token |
| `KOMODO_WEBHOOK_URL` | Yes | Komodo GitOps webhook endpoint |
| `KOMODO_API_KEY` | Yes | Sent as `X-Api-Key` header |
| `KOMODO_API_SECRET` | Yes | Sent as `X-Api-Secret` header |
| `STATE_FILE` | No | State file path (default: `data/state.json`) |
| `RUN_LOG_FILE` | No | Run history file path (default: `data/run-log.json`) |

If `STATE_FILE` / `RUN_LOG_FILE` do not exist, the app creates the parent directory and file automatically.

---

## Install and run

```bash
npm install
npm run build
npm start
```

Development mode:

```bash
npm run dev
```

---

## Example environment setup

```env
AZDO_ORG_URL=https://dev.azure.com/contoso
AZDO_PAT=xxxxxxxxxxxxxxxxxxxx
KOMODO_WEBHOOK_URL=https://komodo.example.com/webhooks/gitops
KOMODO_API_KEY=your-api-key
KOMODO_API_SECRET=your-api-secret

# Optional
STATE_FILE=./data/state.json
RUN_LOG_FILE=./data/run-log.json
```

> Note: the project does not automatically load a `.env` file. Export variables in your runtime environment (or inject them via pipeline variables / dotenv tooling).

---

## Webhook payload

Webhook is sent only when one or more `*.conf` files changed in the new commit.

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

Field meanings:

- `environments`: all detected environments from repo `*.conf` files
- `changedEnvironments`: environments changed in the current commit
- `komodoEnvironments`: formatted keys `{ProjectSanitized}_Nginx_DevOps_{environment}`

---

## Output files

### State file (`STATE_FILE`)

Stores last processed commit per repository:

```json
{
  "repositories": {
    "<repo-id>": {
      "commitId": "<commit SHA>",
      "repoName": "ProjectName_Nginx_DevOps",
      "projectName": "Project Name"
    }
  }
}
```

### Run log file (`RUN_LOG_FILE`)

Appends one entry per run (including skipped cases):

```json
{
  "runs": [
    {
      "timestamp": "2026-04-08T12:00:00.000Z",
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

---

## Behavior details

- Only `main` is tracked.
- No webhook is sent when there is no new commit.
- No webhook is sent when commit changed but no environment `*.conf` files changed.
- Environment names are normalized to lowercase:
  - `Demo.conf` -> `demo`
  - `DEMO.conf` -> `demo`
- Environment list is deduplicated and sorted.

---

## Troubleshooting

### `Missing required environment variable`

One or more required environment variables are not set.

### Komodo webhook returns `405`

The endpoint likely does not accept POST at the configured URL. Verify webhook listener route and HTTP method.

### New commit exists but webhook was not triggered

Most likely no `*.conf` environment files changed in that commit. This is expected behavior and is logged as:

`Skipped webhook (no environment file changes)`

---

## Scheduling

This tracker is designed for periodic execution. Typical options:

- Azure DevOps scheduled pipeline
- Cron job
- Kubernetes CronJob
- Any recurring task runner

---

## NPM scripts

- `npm run build` — compile TypeScript into `dist/`
- `npm start` — run compiled app (`dist/index.js`)
- `npm run dev` — run TypeScript directly via `ts-node`

---

## License

MIT
