import { beforeEach, describe, expect, it, vi } from "vitest";

const records = new Map<string, unknown>();

vi.mock("../../src/lib/offlineDb", () => ({
  openDB: async () => ({
    transaction: () => ({
      objectStore: () => ({
        put: (value: { id: string }) => request(() => records.set(value.id, value)),
        get: (id: string) => request(() => records.get(id)),
        getAll: () => request(() => [...records.values()]),
        delete: (id: string) => request(() => records.delete(id)),
      }),
    }),
  }),
}));

import {
  deleteShare,
  getShare,
  pruneExpiredShares,
  retainFailedShareFiles,
  stageShare,
  updateShare,
} from "../../src/lib/shareInbox";

function request(run: () => unknown) {
  const result = run();
  const value: {
    result: unknown;
    error: null;
    onsuccess: (() => void) | null;
    onerror: (() => void) | null;
  } = { result, error: null, onsuccess: null, onerror: null };
  queueMicrotask(() => value.onsuccess?.());
  return value;
}

beforeEach(() => {
  records.clear();
});

describe("retainFailedShareFiles", () => {
  it("keeps only files that failed to upload", () => {
    const files = [
      new File(["a"], "notice.jpg", { type: "image/jpeg" }),
      new File(["b"], "assignment.pdf", { type: "application/pdf" }),
    ];

    expect(retainFailedShareFiles(files, [{ filename: "assignment.pdf", error: "offline" }]))
      .toEqual([files[1]]);
  });
});

describe("share inbox lifecycle", () => {
  it("stages, reads, updates, and deletes a local share", async () => {
    const entry = await stageShare([new File(["x"], "notice.jpg", { type: "image/jpeg" })], " Faculty notice ");

    expect((await getShare(entry.id))?.caption).toBe("Faculty notice");
    await updateShare({ ...entry, caption: "Updated" });
    expect((await getShare(entry.id))?.caption).toBe("Updated");
    await deleteShare(entry.id);
    expect(await getShare(entry.id)).toBeNull();
  });

  it("prunes expired shares", async () => {
    const entry = await stageShare([new File(["x"], "notice.pdf", { type: "application/pdf" })]);
    await updateShare({ ...entry, expiresAt: Date.now() - 1 });

    await pruneExpiredShares();

    expect(await getShare(entry.id)).toBeNull();
  });
});
