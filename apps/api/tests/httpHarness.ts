import { EventEmitter } from "node:events";

import type { Express } from "express";
import { createRequest, createResponse } from "node-mocks-http";

interface AppRequest {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface AppResponse {
  status: number;
  body: unknown;
}

export async function dispatchRequest(
  app: Express,
  request: AppRequest,
): Promise<AppResponse> {
  const req = createRequest({
    method: request.method,
    url: request.path,
    headers: {
      "content-type": "application/json",
      ...request.headers,
    },
    body: request.body,
  });
  const response = createResponse({
    eventEmitter: EventEmitter,
  });

  await new Promise<void>((resolve) => {
    response.on("end", () => resolve());
    app.handle(req, response);
  });

  const bodyText = response._getData();

  return {
    status: response.statusCode,
    body: bodyText ? response._getJSONData() : undefined,
  };
}
