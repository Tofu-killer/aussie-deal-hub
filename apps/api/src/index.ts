import { buildApp } from "./app.ts";

const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? "127.0.0.1";

buildApp().listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});
