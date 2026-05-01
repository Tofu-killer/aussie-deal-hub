const API_BASE_URL_ENV_NAME = "API_BASE_URL";

export class ServerApiConfigurationError extends Error {
  constructor() {
    super(`${API_BASE_URL_ENV_NAME} is required for server-side web API requests.`);
    this.name = "ServerApiConfigurationError";
  }
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function getServerApiBaseUrl() {
  const apiBaseUrl = process.env.API_BASE_URL?.trim();

  if (!apiBaseUrl) {
    throw new ServerApiConfigurationError();
  }

  return normalizeBaseUrl(apiBaseUrl);
}

export function buildServerApiUrl(path: string) {
  return new URL(path, `${getServerApiBaseUrl()}/`).toString();
}

export function isServerApiConfigurationError(
  error: unknown,
): error is ServerApiConfigurationError {
  return error instanceof ServerApiConfigurationError;
}
