import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

import { Router } from "express";

export interface SessionRecord {
  email: string;
}

export interface SessionManager {
  issueSession(email: string): string;
  readSession(sessionToken: string | undefined): SessionRecord | undefined;
}

export interface VerificationCodeStore {
  saveCode(email: string, code: string, expiresAt: number): void;
  consumeCode(email: string, code: string, now: number): "valid" | "invalid" | "expired";
}

export interface AuthCodeSender {
  sendVerificationCode(input: {
    email: string;
    code: string;
    ttlMs: number;
  }): Promise<void>;
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

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
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

function hashVerificationCode(code: string) {
  return createHash("sha256").update(code).digest("base64url");
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

export function createInMemoryVerificationCodeStore(
  codes: Map<string, { codeHash: string; expiresAt: number }> = new Map(),
): VerificationCodeStore {
  return {
    saveCode(email, code, expiresAt) {
      codes.set(normalizeEmail(email), {
        codeHash: hashVerificationCode(code),
        expiresAt,
      });
    },
    consumeCode(email, code, now) {
      const normalizedEmail = normalizeEmail(email);
      const record = codes.get(normalizedEmail);

      if (!record) {
        return "invalid";
      }

      if (record.expiresAt < now) {
        codes.delete(normalizedEmail);
        return "expired";
      }

      if (!hasMatchingSignature(record.codeHash, hashVerificationCode(code))) {
        return "invalid";
      }

      codes.delete(normalizedEmail);
      return "valid";
    },
  };
}

export function createSixDigitCodeGenerator() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
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
  verificationCodeStore: VerificationCodeStore,
  sessionManager: SessionManager,
  authCodeSender: AuthCodeSender,
  options: {
    codeGenerator?: () => string;
    codeTtlMs?: number;
    now?: () => number;
  } = {},
) {
  const router = Router();
  const codeGenerator = options.codeGenerator ?? createSixDigitCodeGenerator;
  const codeTtlMs = options.codeTtlMs ?? 10 * 60 * 1000;
  const now = options.now ?? Date.now;

  router.post("/request-code", async (request, response) => {
    const input = request.body as RequestCodeInput | undefined;

    if (!isRequestCodeInput(input)) {
      response.status(400).json({ message: "Email is required." });
      return;
    }

    const email = normalizeEmail(input.email);
    const code = codeGenerator();

    try {
      await authCodeSender.sendVerificationCode({
        email,
        code,
        ttlMs: codeTtlMs,
      });
    } catch {
      response.status(503).json({ message: "Unable to deliver verification code." });
      return;
    }

    verificationCodeStore.saveCode(email, code, now() + codeTtlMs);
    response.json({ ok: true });
  });

  router.post("/verify-code", (request, response) => {
    const input = request.body as VerifyCodeInput | undefined;

    if (!isVerifyCodeInput(input)) {
      response.status(400).json({ message: "Email and code are required." });
      return;
    }

    const email = normalizeEmail(input.email);
    const codeStatus = verificationCodeStore.consumeCode(email, input.code, now());

    if (codeStatus === "expired") {
      response.status(401).json({ message: "Code expired." });
      return;
    }

    if (codeStatus !== "valid") {
      response.status(401).json({ message: "Invalid code." });
      return;
    }

    const sessionToken = sessionManager.issueSession(email);

    response.json({ sessionToken });
  });

  return router;
}
