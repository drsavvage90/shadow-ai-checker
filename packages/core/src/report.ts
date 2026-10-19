import type { AnonymousCountSink, AnonymousCountSnapshot } from "./types.js";

/**
 * Default sink for anonymous counts. It does not open a socket, and it does
 * not read the snapshot. A future opt-in dashboard would supply a different
 * sink. This open-source build ships only the no-op.
 */
export const localOnlySink: AnonymousCountSink = {
  async send(_snapshot: AnonymousCountSnapshot): Promise<void> {
    return;
  },
};

export type { AnonymousCountSink, AnonymousCountSnapshot };
