import { useCallback, useRef, useState } from "react";
import BokReader, {
    type BokReaderHandle,
    BokReaderSyncConflict,
    type BokReaderSyncEvent,
    type BokReaderSyncSnapshot,
    type BokReaderSyncState
} from "../src/components/BokReader/BokReader";
import "../src/style.css";

function App() {
    const epubUrl =
        "https://43ru4bvzl6.ufs.sh/f/7NUfZePLME3PMnSWDPukmni4ZH3xrC18PNcw20Bs5begvd6F";

    const readerRef = useRef<BokReaderHandle>(null);
    const [syncState, setSyncState] = useState<BokReaderSyncState | null>(null);

    const handleReaderTitleChange = useCallback((title: string) => {
        if (title && title !== "Loading...") {
            document.title = title;
        } else {
            document.title = "Bok";
        }
        console.log("[BokExample] onTitleChange:", title);
    }, []);

    const handleReaderError = useCallback((errorMsg: string) => {
        console.error("BokReader reported an error:", errorMsg);
        alert(`Error loading book: ${errorMsg}\nPlease try a different file.`);
    }, []);

    const handleReaderLoading = useCallback((isLoading: boolean) => {
        console.log("[BokExample] onLoadingChange:", isLoading);
    }, []);

    const handleSyncEvent = useCallback((event: BokReaderSyncEvent) => {
        console.log("[BokExample] onSyncEvent:", event.type, event);
    }, []);

    const handleConflictDetected = useCallback((conflict: BokReaderSyncConflict) => {
        console.warn("[BokExample] onConflictDetected:", conflict);
    }, []);

    const logSnapshot = useCallback(() => {
        const snapshot = readerRef.current?.getSyncSnapshot() ?? null;
        console.log("[BokExample] getSyncSnapshot:", snapshot);
    }, []);

    const logPendingEvents = useCallback(() => {
        const pendingEvents = readerRef.current?.getPendingSyncEvents() ?? [];
        console.log("[BokExample] getPendingSyncEvents:", pendingEvents);
    }, []);

    const acknowledgePendingEvents = useCallback(() => {
        const pendingEvents = readerRef.current?.getPendingSyncEvents() ?? [];
        const mutationIds = pendingEvents.map((event) => event.mutationId);
        if (mutationIds.length === 0) {
            console.log("[BokExample] No pending sync events to acknowledge.");
            return;
        }

        readerRef.current?.acknowledgeSyncEvents(mutationIds);
        console.log("[BokExample] acknowledgeSyncEvents:", mutationIds);
    }, []);

    const simulateRemoteProgress = useCallback((forceApply: boolean) => {
        const snapshot = readerRef.current?.getSyncSnapshot();
        if (!snapshot) {
            console.log("[BokExample] Snapshot unavailable; wait for book to load.");
            return;
        }

        const remoteProgress = Math.max(0, Math.min(1, snapshot.progress + 0.15));
        const nextState: BokReaderSyncState = {
            bookId: snapshot.bookId,
            progress: remoteProgress,
            revision: `example-${Date.now()}`,
            forceApply
        };

        setSyncState(nextState);
        console.log("[BokExample] set syncState:", nextState);
    }, []);

    const simulateRemoteHighlights = useCallback((forceApply: boolean) => {
        const snapshot = readerRef.current?.getSyncSnapshot();
        if (!snapshot) {
            console.log("[BokExample] Snapshot unavailable; wait for book to load.");
            return;
        }

        const remoteHighlights: BokReaderSyncSnapshot["highlights"] = snapshot.highlights.slice(0, 1).map((highlight) => ({
            ...highlight,
            color: highlight.color === "yellow" ? "red" : "yellow"
        }));

        const nextState: BokReaderSyncState = {
            bookId: snapshot.bookId,
            highlights: remoteHighlights,
            revision: `example-${Date.now()}`,
            forceApply
        };

        setSyncState(nextState);
        console.log("[BokExample] set syncState:", nextState);
    }, []);

    const supportedFonts = [
        { name: "Merriweather", displayName: "Merriweather" },
    ];

    const themes = {
        "Cyberpunk": {
            "--bg-color": "#050505",
            "--text-color": "#00ff9f",
            "--color-tint": "#00ff9f"
        }
    };

    return (
        <>
            <div
                style={{
                    position: "fixed",
                    top: "12px",
                    left: "12px",
                    zIndex: 9999,
                    display: "flex",
                    gap: "6px",
                    flexWrap: "wrap",
                    padding: "8px",
                    background: "rgba(0, 0, 0, 0.75)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "8px"
                }}
            >
                <button type="button" onClick={logSnapshot}>Log Snapshot</button>
                <button type="button" onClick={logPendingEvents}>Log Pending</button>
                <button type="button" onClick={acknowledgePendingEvents}>Ack Pending</button>
                <button type="button" onClick={() => simulateRemoteProgress(false)}>Remote Progress</button>
                <button type="button" onClick={() => simulateRemoteProgress(true)}>Force Progress</button>
                <button type="button" onClick={() => simulateRemoteHighlights(false)}>Remote Highlight</button>
                <button type="button" onClick={() => simulateRemoteHighlights(true)}>Force Highlight</button>
            </div>

            <div
                style={{
                    width: "100svw",
                    height: "100svh",
                    overflow: "hidden",
                }}
            >
                <BokReader
                    ref={readerRef}
                    epubDataSource={epubUrl}
                    onTitleChange={handleReaderTitleChange}
                    onError={handleReaderError}
                    onLoadingChange={handleReaderLoading}
                    onSyncEvent={handleSyncEvent}
                    syncState={syncState}
                    onConflictDetected={handleConflictDetected}
                    supportedFonts={supportedFonts}
                    themes={themes}
                />
            </div>
        </>
    );
}

export default App;
