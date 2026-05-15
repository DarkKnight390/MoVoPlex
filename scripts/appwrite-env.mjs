import { existsSync, readFileSync } from "node:fs";

export const loadEnvFiles = () => {
  const envFiles = [".env.local", ".env"];

  for (const file of envFiles) {
    if (!existsSync(file)) {
      continue;
    }

    const contents = readFileSync(file, "utf8");

    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
};

export const getMissingEnv = (requiredKeys) =>
  requiredKeys.filter((key) => !process.env[key]);

export const createAppwriteRequest = ({ endpoint, projectId, apiKey }) => {
  const normalizedEndpoint = endpoint.replace(/\/+$/, "");

  return async (method, path, body) => {
    const response = await fetch(`${normalizedEndpoint}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": projectId,
        "X-Appwrite-Key": apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) {
      return null;
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(
        payload?.message || `Appwrite request failed with status ${response.status}`
      );
      error.statusCode = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  };
};
