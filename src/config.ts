import * as path from "path";
import * as fs from "fs";

export interface TrackerConfig {
  organizationUrl: string;
  personalAccessToken: string;
  komodoWebhookUrl: string;
  stateFile: string;
  runLogFile: string;
}

const DEFAULT_STATE_FILE = path.join(__dirname, "..", "data", "state.json");
const DEFAULT_RUN_LOG_FILE = path.join(__dirname, "..", "data", "run-log.json");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): TrackerConfig {
  const organizationUrl = requireEnv("AZDO_ORG_URL");
  const personalAccessToken = requireEnv("AZDO_PAT");
  const komodoWebhookUrl = requireEnv("KOMODO_WEBHOOK_URL");
  const stateFile = process.env.STATE_FILE || DEFAULT_STATE_FILE;
  const runLogFile = process.env.RUN_LOG_FILE || DEFAULT_RUN_LOG_FILE;

  ensureStateFile(stateFile);
  ensureRunLogFile(runLogFile);

  return {
    organizationUrl,
    personalAccessToken,
    komodoWebhookUrl,
    stateFile,
    runLogFile,
  };
}

function ensureStateFile(stateFile: string): void {
  const directory = path.dirname(stateFile);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile, JSON.stringify({ repositories: {} }, null, 2));
  }
}

function ensureRunLogFile(runLogFile: string): void {
  const directory = path.dirname(runLogFile);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(runLogFile)) {
    fs.writeFileSync(runLogFile, JSON.stringify({ runs: [] }, null, 2));
  }
}
