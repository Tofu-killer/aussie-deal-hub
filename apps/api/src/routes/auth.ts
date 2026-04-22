import { randomUUID } from "node:crypto";

import { Router } from "express";

export interface SessionRecord {
  email: string;
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

export function createAuthRouter(
  codes: Map<string, string>,
  sessions: Map<string, SessionRecord>,
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

    const sessionToken = randomUUID();
    sessions.set(sessionToken, { email: input.email });

    response.json({ sessionToken });
  });

  return router;
}
