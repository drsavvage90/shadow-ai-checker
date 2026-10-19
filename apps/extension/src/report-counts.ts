import { localOnlySink, type AnonymousCountSnapshot } from "@shadow-ai/core/report";

/**
 * Future hook for optional reporting of anonymous counts to a firm dashboard.
 * The sink shipped here does not make a network call. Replace it only together
 * with an explicit opt-in and an updated employee notice.
 */
export async function reportAnonymousCounts(snapshot: AnonymousCountSnapshot): Promise<void> {
  await localOnlySink.send(snapshot);
}
