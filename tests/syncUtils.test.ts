import { describe, expect, test } from "bun:test";
import {
    acknowledgePendingSyncEvents,
    areHighlightsEqual,
    clampProgress,
    enqueuePendingSyncEvent,
    getSyncStateFingerprint,
    hasProgressConflict,
    listPendingSyncEvents
} from "../src/components/BokReader/syncUtils";

const h1 = {
    id: "h1",
    chapterId: "c1",
    start: 0,
    end: 10,
    color: "yellow" as const,
    text: "first"
};

const h2 = {
    id: "h2",
    chapterId: "c1",
    start: 12,
    end: 20,
    color: "blue" as const,
    text: "second"
};

describe("clampProgress", () => {
    test("clamps into [0, 1]", () => {
        expect(clampProgress(-1)).toBe(0);
        expect(clampProgress(0.4)).toBe(0.4);
        expect(clampProgress(2)).toBe(1);
    });
});

describe("areHighlightsEqual", () => {
    test("is order-insensitive", () => {
        expect(areHighlightsEqual([h1, h2], [h2, h1])).toBe(true);
    });

    test("detects actual data changes", () => {
        const changed = [{ ...h1, color: "red" as const }, h2];
        expect(areHighlightsEqual([h1, h2], changed)).toBe(false);
    });
});

describe("getSyncStateFingerprint", () => {
    test("is stable for reordered highlights", () => {
        const base = {
            bookId: "book-1",
            revision: "rev-1",
            progress: 0.42,
            highlights: [h1, h2]
        };

        const reordered = {
            ...base,
            highlights: [h2, h1]
        };

        expect(getSyncStateFingerprint(base)).toBe(getSyncStateFingerprint(reordered));
    });

    test("changes when highlight content changes", () => {
        const base = {
            bookId: "book-1",
            progress: 0.42,
            highlights: [h1]
        };

        const changed = {
            ...base,
            highlights: [{ ...h1, text: "updated" }]
        };

        expect(getSyncStateFingerprint(base)).not.toBe(getSyncStateFingerprint(changed));
    });
});

describe("hasProgressConflict", () => {
    test("flags local non-zero vs remote reset-to-zero", () => {
        expect(hasProgressConflict(0.73, 0)).toBe(true);
    });

    test("does not flag when local side is empty", () => {
        expect(hasProgressConflict(0, 0.73)).toBe(false);
    });

    test("does not flag when remote progress is missing", () => {
        expect(hasProgressConflict(0.7, undefined)).toBe(false);
    });
});

describe("pending sync event helpers", () => {
    test("lists pending events in emitted order and acknowledges selected events", () => {
        const pending = new Map<string, { mutationId: string; emittedAt: number; type: string }>();
        enqueuePendingSyncEvent(pending, { mutationId: "m2", emittedAt: 20, type: "x" });
        enqueuePendingSyncEvent(pending, { mutationId: "m1", emittedAt: 10, type: "x" });
        enqueuePendingSyncEvent(pending, { mutationId: "m3", emittedAt: 30, type: "x" });

        expect(listPendingSyncEvents(pending).map((event) => event.mutationId)).toEqual(["m1", "m2", "m3"]);

        acknowledgePendingSyncEvents(pending, ["m1", "m3"]);
        expect(listPendingSyncEvents(pending).map((event) => event.mutationId)).toEqual(["m2"]);
    });
});
