type LeadRecord = {
  review: unknown | null;
};

type WorkerLeadStoreContract = {
  createLeadIfNew: (...args: never[]) => unknown;
  listLeadRecords: () => Promise<LeadRecord[]>;
  saveLeadReviewDraft: unknown;
};

export function createWorkerLeadStore<T extends WorkerLeadStoreContract>(
  leadStore: T,
  reviewEnabled: boolean,
): T {
  if (reviewEnabled) {
    return leadStore;
  }

  return {
    ...leadStore,
    createLeadIfNew: leadStore.createLeadIfNew,
    async listLeadRecords() {
      return (await leadStore.listLeadRecords()).filter((record) => record.review !== null);
    },
    saveLeadReviewDraft: leadStore.saveLeadReviewDraft,
  };
}
