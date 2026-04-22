import { buildApp } from "./app.ts";
import {
  getDigestSubscription,
  upsertDigestSubscription,
} from "@aussie-deal-hub/db/repositories/digestSubscriptions";
import { listPriceSnapshotsForDeal } from "@aussie-deal-hub/db/repositories/priceSnapshots";

const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? "127.0.0.1";

buildApp({
  digestPreferencesStore: {
    getByEmail: getDigestSubscription,
    upsertByEmail(email, input) {
      return upsertDigestSubscription({ email, ...input });
    },
  },
  priceSnapshotStore: {
    listSnapshotsForDeal: listPriceSnapshotsForDeal,
  },
}).listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});
