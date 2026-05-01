const ADMIN_API_BASE_URL_ENV_NAME = "ADMIN_API_BASE_URL";

export class AdminApiConfigurationError extends Error {
  constructor() {
    super(`${ADMIN_API_BASE_URL_ENV_NAME} is required for admin runtime API requests.`);
    this.name = "AdminApiConfigurationError";
  }
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function getAdminApiBaseUrl() {
  const apiBaseUrl = process.env.ADMIN_API_BASE_URL?.trim();

  if (!apiBaseUrl) {
    throw new AdminApiConfigurationError();
  }

  return normalizeBaseUrl(apiBaseUrl);
}

export function buildAdminApiUrl(path: string) {
  return new URL(path, `${getAdminApiBaseUrl()}/`).toString();
}

export function isAdminApiConfigurationError(
  error: unknown,
): error is AdminApiConfigurationError {
  return error instanceof AdminApiConfigurationError;
}
