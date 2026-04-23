import { buildApp } from "./app.ts";
import { parseApiEnv } from "../../../packages/config/src/env.ts";
import {
  getDigestSubscription,
  upsertDigestSubscription,
} from "@aussie-deal-hub/db/repositories/digestSubscriptions";
import { createAdminLeadRepository } from "@aussie-deal-hub/db/repositories/leads";
import { listPriceSnapshotsForDeal } from "@aussie-deal-hub/db/repositories/priceSnapshots";
import { listSources, updateSourceEnabled } from "@aussie-deal-hub/db/repositories/sources";

const { API_HOST: host, API_PORT: port } = parseApiEnv(process.env);
const adminLeadStore = createAdminLeadRepository();

buildApp({
  adminLeadStore,
  digestPreferencesStore: {
    getByEmail: getDigestSubscription,
    upsertByEmail(email, input) {
      return upsertDigestSubscription({ email, ...input });
    },
  },
  priceSnapshotStore: {
    listSnapshotsForDeal: listPriceSnapshotsForDeal,
  },
  sourceStore: {
    list: listSources,
    setEnabled: updateSourceEnabled,
  },
}).listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});
