import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { Router } from "express";

export interface SessionRecord {
  email: string;
}

export interface SessionManager {
  issueSession(email: string): string;
  readSession(sessionToken: string | undefined): SessionRecord | undefined;
}

interface RequestCodeInput {
  email: string;
}

interface VerifyCodeInput {
  email: string;
  code: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRequestCodeInput(value: unknown): value is RequestCodeInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  return isNonEmptyString((value as Record<string, unknown>).email);
}

function isVerifyCodeInput(value: unknown): value is VerifyCodeInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return isNonEmptyString(candidate.email) && isNonEmptyString(candidate.code);
}

function encodeTokenValue(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeTokenValue(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function buildSessionSignature(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function hasMatchingSignature(signature: string, expectedSignature: string) {
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}

export function createInMemorySessionManager(
  sessions: Map<string, SessionRecord> = new Map(),
): SessionManager {
  return {
    issueSession(email) {
      const sessionToken = randomUUID();
      sessions.set(sessionToken, { email });
      return sessionToken;
    },
    readSession(sessionToken) {
      if (!sessionToken) {
        return undefined;
      }

      return sessions.get(sessionToken);
    },
  };
}

export function createSignedSessionManager(
  secret: string,
  sessionTtlMs = 1000 * 60 * 60 * 24 * 30,
): SessionManager {
  return {
    issueSession(email) {
      const now = Date.now();
      const payload = JSON.stringify({
        email,
        issuedAt: now,
        expiresAt: now + sessionTtlMs,
      });
      const encodedPayload = encodeTokenValue(payload);
      const signature = buildSessionSignature(secret, encodedPayload);

      return `${encodedPayload}.${signature}`;
    },
    readSession(sessionToken) {
      if (!sessionToken) {
        return undefined;
      }

      const [encodedPayload, signature] = sessionToken.split(".");

      if (!encodedPayload || !signature) {
        return undefined;
      }

      const expectedSignature = buildSessionSignature(secret, encodedPayload);

      if (!hasMatchingSignature(signature, expectedSignature)) {
        return undefined;
      }

      try {
        const payload = JSON.parse(decodeTokenValue(encodedPayload)) as {
          email?: unknown;
          expiresAt?: unknown;
        };

        if (
          !isNonEmptyString(payload.email) ||
          typeof payload.expiresAt !== "number" ||
          payload.expiresAt < Date.now()
        ) {
          return undefined;
        }

        return {
          email: payload.email,
        };
      } catch {
        return undefined;
      }
    },
  };
}

export function createAuthRouter(
  codes: Map<string, string>,
  sessionManager: SessionManager,
) {
  const router = Router();

  router.post("/request-code", (request, response) => {
    const input = request.body as RequestCodeInput | undefined;

    if (!isRequestCodeInput(input)) {
      response.status(400).json({ message: "Email is required." });
      return;
    }

    codes.set(input.email, "123456");
    response.json({ ok: true });
  });

  router.post("/verify-code", (request, response) => {
    const input = request.body as VerifyCodeInput | undefined;

    if (!isVerifyCodeInput(input)) {
      response.status(400).json({ message: "Email and code are required." });
      return;
    }

    if (codes.get(input.email) !== input.code) {
      response.status(401).json({ message: "Invalid code." });
      return;
    }

    codes.delete(input.email);

    const sessionToken = sessionManager.issueSession(input.email);

    response.json({ sessionToken });
  });

  return router;
}
