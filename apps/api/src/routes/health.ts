import { Router } from "express";

export function healthPayload() {
  return {
    ok: true
  };
}

export function createHealthRouter() {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json(healthPayload());
  });

  return router;
}
