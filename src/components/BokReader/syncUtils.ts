import type { Highlight } from "../Book";

export interface SyncStateFingerprintInput {
    bookId: string;
    progress?: number;
    highlights?: Highlight[];
    revision?: string | number;
    forceApply?: boolean;
}

export interface PendingSyncEvent {
    mutationId: string;
    emittedAt: number;
}

export const PROGRESS_EPSILON = 0.0001;

export function clampProgress(progress: number): number {
    if (!Number.isFinite(progress)) return 0;
    return Math.max(0, Math.min(1, progress));
}

export function cloneHighlights(highlights: Highlight[]): Highlight[] {
    return highlights.map((highlight) => ({ ...highlight }));
}

function serializeHighlight(highlight: Highlight): string {
    return `${highlight.id}:${highlight.chapterId}:${highlight.start}:${highlight.end}:${highlight.color}:${highlight.text ?? ""}`;
}

function buildHighlightCountMap(highlights: Highlight[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const highlight of highlights) {
        const key = serializeHighlight(highlight);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

export function areHighlightsEqual(left: Highlight[], right: Highlight[]): boolean {
    if (left.length !== right.length) return false;

    const leftCounts = buildHighlightCountMap(left);
    const rightCounts = buildHighlightCountMap(right);

    if (leftCounts.size !== rightCounts.size) return false;

    for (const [key, leftCount] of leftCounts) {
        if (rightCounts.get(key) !== leftCount) return false;
    }

    return true;
}

function hashString32(input: string): number {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function getHighlightsSignature(highlights: Highlight[] | undefined): string {
    if (!highlights) return "none";

    let sum = 0;
    let xor = 0;
    let mix = 0;

    for (const highlight of highlights) {
        const hashed = hashString32(serializeHighlight(highlight));
        sum = (sum + hashed) >>> 0;
        xor = (xor ^ hashed) >>> 0;
        mix = (mix + Math.imul(hashed, 2654435761)) >>> 0;
    }

    return `${highlights.length}:${sum.toString(16)}:${xor.toString(16)}:${mix.toString(16)}`;
}

export function getSyncStateFingerprint(syncState: SyncStateFingerprintInput): string {
    const revision = syncState.revision !== undefined ? String(syncState.revision) : "none";
    const progress = typeof syncState.progress === "number"
        ? clampProgress(syncState.progress).toFixed(6)
        : "none";
    const highlightsSignature = getHighlightsSignature(syncState.highlights);
    const forceApply = syncState.forceApply ? "1" : "0";

    return `${syncState.bookId}|${revision}|${progress}|${highlightsSignature}|${forceApply}`;
}

export function hasProgressConflict(localProgress: number, remoteProgress: number | undefined): boolean {
    if (typeof remoteProgress !== "number") return false;

    const normalizedLocal = clampProgress(localProgress);
    const normalizedRemote = clampProgress(remoteProgress);

    if (normalizedLocal <= PROGRESS_EPSILON) return false;

    return Math.abs(normalizedLocal - normalizedRemote) > PROGRESS_EPSILON;
}

export function enqueuePendingSyncEvent<TEvent extends PendingSyncEvent>(
    pendingEvents: Map<string, TEvent>,
    event: TEvent
): void {
    pendingEvents.set(event.mutationId, event);
}

export function listPendingSyncEvents<TEvent extends PendingSyncEvent>(
    pendingEvents: Map<string, TEvent>
): TEvent[] {
    return Array.from(pendingEvents.values())
        .sort((left, right) => left.emittedAt - right.emittedAt);
}

export function acknowledgePendingSyncEvents<TEvent extends PendingSyncEvent>(
    pendingEvents: Map<string, TEvent>,
    mutationIds: string | string[]
): void {
    const ids = Array.isArray(mutationIds) ? mutationIds : [mutationIds];
    for (const mutationId of ids) {
        pendingEvents.delete(mutationId);
    }
}
