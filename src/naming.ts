import { GitItem } from "azure-devops-node-api/interfaces/GitInterfaces";

const CONF_EXTENSION = ".conf";

export function sanitizeProjectName(projectName: string): string {
  return projectName.replace(/\s+/g, "");
}

export function detectEnvironments(items: GitItem[]): string[] {
  return detectEnvironmentsFromPaths(
    items
      .filter((item) => Boolean(item.path))
      .map((item) => item.path || "")
  );
}

export function formatKomodoEnvironmentKeys(projectSanitized: string, environments: string[]): string[] {
  return environments.map((env) => `${projectSanitized}_Nginx_DevOps_${env}`);
}

export function detectEnvironmentsFromPaths(paths: string[]): string[] {
  return paths
    .filter((path) => path.endsWith(CONF_EXTENSION))
    .map((path) => path.split("/").pop() || "")
    .map((fileName) => fileName.replace(CONF_EXTENSION, "").toLowerCase())
    .filter((name, index, arr) => name && arr.indexOf(name) === index)
    .sort();
}
