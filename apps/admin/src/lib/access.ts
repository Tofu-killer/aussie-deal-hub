const DEFAULT_ADMIN_BASIC_AUTH_REALM = "Aussie Deal Hub Admin";

interface AdminAccessEnv {
  [key: string]: string | undefined;
  ADMIN_BASIC_AUTH_PASSWORD?: string;
  ADMIN_BASIC_AUTH_REALM?: string;
  ADMIN_BASIC_AUTH_USERNAME?: string;
}

export interface AdminBasicAuthConfig {
  password: string;
  realm: string;
  username: string;
}

function decodeBase64(encodedValue: string) {
  if (typeof atob === "function") {
    return atob(encodedValue);
  }

  return Buffer.from(encodedValue, "base64").toString("utf8");
}

export function getAdminBasicAuthConfig(
  env: AdminAccessEnv = process.env,
): AdminBasicAuthConfig | null {
  const username = env.ADMIN_BASIC_AUTH_USERNAME?.trim() ?? "";
  const password = env.ADMIN_BASIC_AUTH_PASSWORD?.trim() ?? "";
  const realm = env.ADMIN_BASIC_AUTH_REALM?.trim() || DEFAULT_ADMIN_BASIC_AUTH_REALM;

  if (!username || !password) {
    return null;
  }

  return {
    username,
    password,
    realm,
  };
}

export function decodeBasicAuthorizationHeader(headerValue: string | null) {
  if (!headerValue?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decodedValue = decodeBase64(headerValue.slice("Basic ".length));
    const separatorIndex = decodedValue.indexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decodedValue.slice(0, separatorIndex),
      password: decodedValue.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function buildAdminBasicAuthChallenge(env: AdminAccessEnv = process.env) {
  const config = getAdminBasicAuthConfig(env);
  const realm = config?.realm ?? DEFAULT_ADMIN_BASIC_AUTH_REALM;

  return `Basic realm="${realm}", charset="UTF-8"`;
}

export function hasValidAdminBasicAuth(
  headerValue: string | null,
  env: AdminAccessEnv = process.env,
) {
  const config = getAdminBasicAuthConfig(env);

  if (!config) {
    return true;
  }

  const credentials = decodeBasicAuthorizationHeader(headerValue);

  if (!credentials) {
    return false;
  }

  return (
    credentials.username === config.username &&
    credentials.password === config.password
  );
}
