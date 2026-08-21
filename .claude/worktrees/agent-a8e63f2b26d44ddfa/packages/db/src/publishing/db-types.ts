import type { getDb } from "../client";

export type PublishingDb = ReturnType<typeof getDb>;
export type PublishingTx = Parameters<Parameters<PublishingDb["transaction"]>[0]>[0];
