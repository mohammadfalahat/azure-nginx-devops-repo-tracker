import * as fs from "fs";
import * as path from "path";

export interface RunLogEntry {
  timestamp: string;
  project: string;
  repo: string;
  branch: string;
  commitId: string;
  environments: string[];
  changedEnvironments: string[];
  komodoEnvironments: string[];
  webhookTriggered: boolean;
  message: string;
}

interface RunLogFile {
  runs: RunLogEntry[];
}

function readRunLog(runLogFile: string): RunLogFile {
  if (!fs.existsSync(runLogFile)) {
    const directory = path.dirname(runLogFile);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(runLogFile, JSON.stringify({ runs: [] }, null, 2));
  }

  const raw = fs.readFileSync(runLogFile, "utf-8");
  try {
    const parsed = JSON.parse(raw) as RunLogFile;
    return parsed.runs ? parsed : { runs: [] };
  } catch {
    return { runs: [] };
  }
}

export function appendRunLogEntry(runLogFile: string, entry: RunLogEntry): void {
  const existing = readRunLog(runLogFile);
  existing.runs.push(entry);
  fs.writeFileSync(runLogFile, JSON.stringify(existing, null, 2));
}
