import React, {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback,
    useImperativeHandle,
    forwardRef
} from "react";
import { Settings, Highlighter } from "lucide-react";
import useEpub from "../../hooks/useEpub";
import usePersistentState from "../../hooks/usePersistentState";
import Book, { BookHandle, Highlight } from "../Book";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import OptionsMenu from "../OptionsMenu/OptionsMenu";
import NavigationMenu from "../NavigationMenu/NavigationMenu";
import HighlightsMenu from "../HighlightsMenu/HighlightsMenu";
import TutorialOverlay from "../TutorialOverlay/TutorialOverlay";
import {
    acknowledgePendingSyncEvents,
    PROGRESS_EPSILON,
    areHighlightsEqual,
    clampProgress,
    cloneHighlights,
    enqueuePendingSyncEvent,
    getSyncStateFingerprint,
    hasProgressConflict,
    listPendingSyncEvents
} from "./syncUtils";
import "./BokReader.css";

export interface Theme {
    "--bg-color": string,
    "--text-color": string,
    "--page-num-text": string,
    "--page-num-bg": string,
    "--page-num-border": string,
    "--color-tint": string
}

export interface BokReaderSyncSnapshot {
    bookId: string;
    progress: number;
    highlights: Highlight[];
}

export interface BokReaderSyncState {
    bookId: string;
    progress?: number;
    highlights?: Highlight[];
    revision?: string | number;
    forceApply?: boolean;
}

type BokReaderSyncEventBase = {
    mutationId: string;
    bookId: string;
    emittedAt: number;
};

export type BokReaderSyncEvent =
    | (BokReaderSyncEventBase & {
        type: "progress.set";
        progress: number;
    })
    | (BokReaderSyncEventBase & {
        type: "highlight.add";
        highlight: Highlight;
    })
    | (BokReaderSyncEventBase & {
        type: "highlight.remove";
        highlightId: string;
    })
    | (BokReaderSyncEventBase & {
        type: "highlight.updateColor";
        highlightId: string;
        color: Highlight["color"];
    });

export type BokReaderSyncConflictEntity = "progress" | "highlights";

export interface BokReaderSyncConflict {
    bookId: string;
    entities: BokReaderSyncConflictEntity[];
    detectedAt: number;
    local: BokReaderSyncSnapshot;
    remote: BokReaderSyncSnapshot;
    proposedSyncState: BokReaderSyncState;
}

export interface BokReaderHandle {
    getSyncSnapshot: () => BokReaderSyncSnapshot | null;
    // Returns true when the state is accepted (applied immediately or queued until reader is ready).
    applySyncState: (syncState: BokReaderSyncState, options?: { forceApply?: boolean }) => boolean;
    getPendingSyncEvents: () => BokReaderSyncEvent[];
    acknowledgeSyncEvents: (mutationIds: string | string[]) => void;
}

interface BokReaderProps {
    epubDataSource: File | ArrayBuffer | string | null;
    onTitleChange?: (title: string) => void;
    onLoadingChange?: (isLoading: boolean) => void;
    onError?: (errorMsg: string) => void;
    onSyncEvent?: (event: BokReaderSyncEvent) => void;
    syncState?: BokReaderSyncState | null;
    onConflictDetected?: (conflict: BokReaderSyncConflict) => void;
    className?: string;
    style?: React.CSSProperties;
    supportedFonts?: { displayName: string; name: string }[];
    themes?: { [key: string]: Theme };
}

const BUILTIN_THEMES: { [key: string]: Theme } = {
    "Da Vinci": {
        "--bg-color": "#e2d2ad",
        "--text-color": "#463425",
        "--page-num-text": "#2b1f15",
        "--page-num-bg": "rgba(70, 52, 37, 0.1)",
        "--page-num-border": "rgba(70, 52, 37, 0.2)",
        "--color-tint": "#c9f"
    },
    "Amoled Dark": {
        "--bg-color": "black",
        "--text-color": "rgb(215, 215, 215)",
        "--page-num-text": "rgba(255, 255, 255, 0.4)",
        "--page-num-bg": "rgba(0, 0, 0, 0.3)",
        "--page-num-border": "rgba(255, 255, 255, 0.2)",
        "--color-tint": "#c9f"
    }
};

const EMPTY_THEMES = {};

type SyncApplyResult = "applied" | "queued" | "rejected";

function createMutationId(prefix: string): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return `${prefix}_${crypto.randomUUID()}`;
    }

    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const BokReader = forwardRef<BokReaderHandle, BokReaderProps>(({
    epubDataSource,
    onTitleChange,
    onLoadingChange,
    onError,
    onSyncEvent,
    syncState,
    onConflictDetected,
    className,
    style,
    supportedFonts = [],
    themes = EMPTY_THEMES,
}, ref) => {
    const { title, bookId, rawContent, toc, isLoading, error, loadEpub, setIsLoading } =
        useEpub();

    const allThemes = useMemo(() => {
        return { ...BUILTIN_THEMES, ...themes };
    }, [themes]);

    const [activeMenu, setActiveMenu] = useState<"none" | "options" | "navigation" | "highlights">("none");

    const [sidePadding, setSidePadding] = usePersistentState<number>("bok_global_side_padding", 20);
    const [fontSize, setFontSize] = usePersistentState<number>("bok_global_fontsize", 1.4);
    const [fontFamily, setFontFamily] = usePersistentState<string>("bok_global_font_family", "Literata");
    const [theme, setTheme] = usePersistentState<string>("bok_global_theme", "Amoled Dark");

    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const highlightsRef = useRef<Highlight[]>([]);
    const progressRef = useRef(0);

    const bokReaderWrapperRef = useRef<HTMLDivElement>(null);
    const bookComponentRef = useRef<BookHandle>(null);

    const [currentBookPage, setCurrentBookPage] = useState(0);
    const [totalBookPages, setTotalBookPages] = useState(0);

    const [tutorialShown, setTutorialShown] = usePersistentState<boolean>("bok_tutorial_shown", false);
    const [showTutorial, setShowTutorial] = useState(!tutorialShown);

    const suppressSyncEmissionRef = useRef(0);
    const lastProgressSyncEventRef = useRef<number | null>(null);
    const hasObservedProgressRef = useRef(false);
    const pendingSyncEventsRef = useRef<Map<string, BokReaderSyncEvent>>(new Map());
    const queuedSyncStateRef = useRef<BokReaderSyncState | null>(null);
    const processedSyncStatesRef = useRef<Set<string>>(new Set());
    const lastConflictFingerprintRef = useRef("");

    const effectiveTheme = (allThemes as { [key: string]: Theme })[theme] ? theme : "Amoled Dark";
    const highlightsStorageKey = bookId ? `bok_highlights_${bookId}` : "";
    const legacyHighlightsStorageKey = title && title !== "Loading..."
        ? `bok_highlights_${title}`
        : "";

    useEffect(() => {
        highlightsRef.current = highlights;
    }, [highlights]);

    const emitSyncEvent = useCallback((event: BokReaderSyncEvent) => {
        enqueuePendingSyncEvent(pendingSyncEventsRef.current, event);
        if (onSyncEvent) {
            onSyncEvent(event);
        }
    }, [onSyncEvent]);

    const getSyncSnapshot = useCallback((): BokReaderSyncSnapshot | null => {
        if (!bookId) return null;

        return {
            bookId,
            progress: clampProgress(progressRef.current),
            highlights: cloneHighlights(highlightsRef.current)
        };
    }, [bookId]);

    const withSyncEmissionSuppressed = useCallback((work: () => void) => {
        suppressSyncEmissionRef.current += 1;
        try {
            work();
        } finally {
            setTimeout(() => {
                suppressSyncEmissionRef.current = Math.max(0, suppressSyncEmissionRef.current - 1);
            }, 0);
        }
    }, []);

    const applySyncStateToReader = useCallback((nextSyncState: BokReaderSyncState): SyncApplyResult => {
        if (!bookId || nextSyncState.bookId !== bookId) return "rejected";

        const readerHandle = bookComponentRef.current;
        if (!readerHandle) {
            queuedSyncStateRef.current = {
                ...nextSyncState,
                highlights: nextSyncState.highlights ? cloneHighlights(nextSyncState.highlights) : undefined
            };
            return "queued";
        }

        withSyncEmissionSuppressed(() => {
            if (typeof nextSyncState.progress === "number") {
                const normalizedProgress = clampProgress(nextSyncState.progress);
                progressRef.current = normalizedProgress;
                lastProgressSyncEventRef.current = normalizedProgress;
                readerHandle.setProgress(normalizedProgress);
            }

            if (Array.isArray(nextSyncState.highlights)) {
                const nextHighlights = cloneHighlights(nextSyncState.highlights);
                highlightsRef.current = nextHighlights;
                setHighlights(nextHighlights);
            }
        });

        return "applied";
    }, [bookId, withSyncEmissionSuppressed]);

    const processExternalSyncState = useCallback((nextSyncState: BokReaderSyncState) => {
        if (!bookId || nextSyncState.bookId !== bookId || isLoading) return;

        const fingerprint = getSyncStateFingerprint(nextSyncState);
        if (processedSyncStatesRef.current.has(fingerprint)) return;

        const localSnapshot = getSyncSnapshot();
        if (!localSnapshot) return;

        const remoteProgress = typeof nextSyncState.progress === "number"
            ? clampProgress(nextSyncState.progress)
            : localSnapshot.progress;
        const remoteHighlights = Array.isArray(nextSyncState.highlights)
            ? cloneHighlights(nextSyncState.highlights)
            : cloneHighlights(localSnapshot.highlights);

        const conflictEntities: BokReaderSyncConflictEntity[] = [];

        if (hasProgressConflict(localSnapshot.progress, nextSyncState.progress)) {
            conflictEntities.push("progress");
        }

        if (
            Array.isArray(nextSyncState.highlights) &&
            localSnapshot.highlights.length > 0 &&
            remoteHighlights.length > 0 &&
            !areHighlightsEqual(localSnapshot.highlights, remoteHighlights)
        ) {
            conflictEntities.push("highlights");
        }

        const shouldForceApply = Boolean(nextSyncState.forceApply);

        if (conflictEntities.length > 0 && !shouldForceApply) {
            if (lastConflictFingerprintRef.current !== fingerprint && onConflictDetected) {
                onConflictDetected({
                    bookId,
                    entities: conflictEntities,
                    detectedAt: Date.now(),
                    local: localSnapshot,
                    remote: {
                        bookId,
                        progress: remoteProgress,
                        highlights: remoteHighlights
                    },
                    proposedSyncState: nextSyncState
                });
            }
            lastConflictFingerprintRef.current = fingerprint;
            return;
        }

        const applyResult = applySyncStateToReader(nextSyncState);
        if (applyResult !== "rejected") {
            processedSyncStatesRef.current.add(fingerprint);
            lastConflictFingerprintRef.current = "";
        }
    }, [applySyncStateToReader, bookId, getSyncSnapshot, isLoading, onConflictDetected]);

    useImperativeHandle(ref, () => ({
        getSyncSnapshot,
        applySyncState: (nextSyncState: BokReaderSyncState, options?: { forceApply?: boolean }) => {
            const forceApply = options?.forceApply;
            const stateToApply = forceApply === undefined
                ? nextSyncState
                : { ...nextSyncState, forceApply };

            return applySyncStateToReader(stateToApply) !== "rejected";
        },
        getPendingSyncEvents: () => {
            return listPendingSyncEvents(pendingSyncEventsRef.current);
        },
        acknowledgeSyncEvents: (mutationIds: string | string[]) => {
            acknowledgePendingSyncEvents(pendingSyncEventsRef.current, mutationIds);
        }
    }), [applySyncStateToReader, getSyncSnapshot]);

    useEffect(() => {
        if (!highlightsStorageKey) return;
        try {
            const stored = localStorage.getItem(highlightsStorageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    const restoredHighlights = cloneHighlights(parsed);
                    highlightsRef.current = restoredHighlights;
                    setHighlights(restoredHighlights);
                    return;
                }
            }

            if (legacyHighlightsStorageKey) {
                const legacyStored = localStorage.getItem(legacyHighlightsStorageKey);
                if (legacyStored) {
                    const parsedLegacy = JSON.parse(legacyStored);
                    if (Array.isArray(parsedLegacy)) {
                        const restoredLegacy = cloneHighlights(parsedLegacy);
                        highlightsRef.current = restoredLegacy;
                        setHighlights(restoredLegacy);
                        localStorage.setItem(highlightsStorageKey, JSON.stringify(restoredLegacy));
                        return;
                    }
                }
            }

            highlightsRef.current = [];
            setHighlights([]);
        } catch (error) {
            console.warn(`Error reading highlights for "${highlightsStorageKey}":`, error);
            highlightsRef.current = [];
            setHighlights([]);
        }
    }, [highlightsStorageKey, legacyHighlightsStorageKey]);

    useEffect(() => {
        if (!highlightsStorageKey) return;
        try {
            localStorage.setItem(highlightsStorageKey, JSON.stringify(highlights));
        } catch (error) {
            console.warn(`Error saving highlights for "${highlightsStorageKey}":`, error);
        }
    }, [highlights, highlightsStorageKey]);

    useEffect(() => {
        if (!syncState) return;
        processExternalSyncState(syncState);
    }, [processExternalSyncState, syncState]);

    useEffect(() => {
        if (isLoading || !bookComponentRef.current || !queuedSyncStateRef.current) return;

        const queuedState = queuedSyncStateRef.current;
        queuedSyncStateRef.current = null;
        applySyncStateToReader(queuedState);
    }, [applySyncStateToReader, isLoading, rawContent]);

    useEffect(() => {
        pendingSyncEventsRef.current.clear();
        processedSyncStatesRef.current.clear();
        lastConflictFingerprintRef.current = "";
        queuedSyncStateRef.current = null;
        lastProgressSyncEventRef.current = null;
        hasObservedProgressRef.current = false;
        progressRef.current = 0;
    }, [bookId]);

    const handleAddHighlight = useCallback((highlight: Highlight) => {
        setHighlights((prev) => [...prev, highlight]);

        if (!bookId || suppressSyncEmissionRef.current > 0) return;

        emitSyncEvent({
            type: "highlight.add",
            mutationId: createMutationId("hl_add"),
            bookId,
            emittedAt: Date.now(),
            highlight: { ...highlight }
        });
    }, [bookId, emitSyncEvent]);

    const handleRemoveHighlight = useCallback((id: string) => {
        setHighlights((prev) => prev.filter((highlight) => highlight.id !== id));

        if (!bookId || suppressSyncEmissionRef.current > 0) return;

        emitSyncEvent({
            type: "highlight.remove",
            mutationId: createMutationId("hl_remove"),
            bookId,
            emittedAt: Date.now(),
            highlightId: id
        });
    }, [bookId, emitSyncEvent]);

    const handleUpdateHighlightColor = useCallback((id: string, color: Highlight["color"]) => {
        setHighlights((prev) => prev.map((highlight) => (
            highlight.id === id ? { ...highlight, color } : highlight
        )));

        if (!bookId || suppressSyncEmissionRef.current > 0) return;

        emitSyncEvent({
            type: "highlight.updateColor",
            mutationId: createMutationId("hl_color"),
            bookId,
            emittedAt: Date.now(),
            highlightId: id,
            color
        });
    }, [bookId, emitSyncEvent]);

    const handleProgressChange = useCallback((progress: number) => {
        const normalizedProgress = clampProgress(progress);
        progressRef.current = normalizedProgress;

        if (!hasObservedProgressRef.current) {
            hasObservedProgressRef.current = true;
            lastProgressSyncEventRef.current = normalizedProgress;
            return;
        }

        if (isLoading || !bookId || suppressSyncEmissionRef.current > 0) return;

        if (
            lastProgressSyncEventRef.current !== null &&
            Math.abs(lastProgressSyncEventRef.current - normalizedProgress) <= PROGRESS_EPSILON
        ) {
            return;
        }

        lastProgressSyncEventRef.current = normalizedProgress;
        emitSyncEvent({
            type: "progress.set",
            mutationId: createMutationId("progress"),
            bookId,
            emittedAt: Date.now(),
            progress: normalizedProgress
        });
    }, [bookId, emitSyncEvent, isLoading]);

    useEffect(() => {
        if (tutorialShown) setShowTutorial(false);
    }, [tutorialShown]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (bokReaderWrapperRef.current) {
                const computedStyle = getComputedStyle(bokReaderWrapperRef.current);
                const bgColor = computedStyle.getPropertyValue("--bg-color").trim();

                let metaThemeColor = document.querySelector("meta[name='theme-color']");
                if (!metaThemeColor) {
                    metaThemeColor = document.createElement("meta");
                    metaThemeColor.setAttribute("name", "theme-color");
                    document.head.appendChild(metaThemeColor);
                }

                if (bgColor) {
                    metaThemeColor.setAttribute("content", bgColor);
                }
            }
        }, 50);

        return () => clearTimeout(timer);
    }, [theme]);

    const dismissTutorial = () => {
        setShowTutorial(false);
        setTutorialShown(true);
    };

    useEffect(() => {
        if (epubDataSource) {
            loadEpub(epubDataSource);
        }
    }, [epubDataSource, loadEpub]);

    useEffect(() => {
        if (onTitleChange) {
            onTitleChange(title);
        }
    }, [title, onTitleChange]);

    useEffect(() => {
        if (onLoadingChange) {
            onLoadingChange(isLoading);
        }
    }, [isLoading, onLoadingChange]);

    useEffect(() => {
        if (error && onError) {
            onError(error);
        }
    }, [error, onError]);

    const dynamicCssVariables = useMemo(
        () => ({
            "--side-padding": `${sidePadding}px`,
            "--top-padding": "30px",
            "--bottom-padding": "70px",
            "--font-size": `${fontSize}em`,
            "--font-family": fontFamily,
            ...(allThemes as { [key: string]: Theme })[effectiveTheme]
        }),
        [sidePadding, fontSize, fontFamily, allThemes, effectiveTheme],
    );

    if (error && !isLoading && !rawContent) {
        return (
            <div
                className={`bok-reader-container ${className || ""}`}
                style={style}
            >
                <div style={{ padding: "20px", color: "red" }}>
                    Error loading EPUB: {error}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`bok-reader-container ${className || ""}`}
            style={{ ...style, ...dynamicCssVariables } as React.CSSProperties}
            ref={bokReaderWrapperRef}
        >
            <LoadingScreen isLoading={isLoading} />

            {rawContent && (
                <>
                    {showTutorial && !isLoading && (
                        <TutorialOverlay
                            onDismiss={dismissTutorial}
                        />
                    )}
                    <Book
                        ref={bookComponentRef}
                        content={rawContent}
                        title={title}
                        bookId={bookId}
                        setIsLoading={setIsLoading}
                        fontSize={fontSize}
                        sidePadding={sidePadding}
                        fontFamily={fontFamily}
                        isOptionMenuVisible={activeMenu !== "none"}
                        containerElementRef={bokReaderWrapperRef}
                        showTutorial={showTutorial}
                        onPageChange={setCurrentBookPage}
                        onPageCountChange={setTotalBookPages}
                        onProgressChange={handleProgressChange}
                        highlights={highlights}
                        onAddHighlight={handleAddHighlight}
                        onRemoveHighlight={handleRemoveHighlight}
                        onUpdateHighlightColor={handleUpdateHighlightColor}
                    />

                    {activeMenu === "options" && (
                        <OptionsMenu
                            onClose={() => setActiveMenu("none")}
                            fontSize={fontSize}
                            padding={sidePadding}
                            fontFamily={fontFamily}
                            theme={theme}
                            setPadding={setSidePadding}
                            setFontSize={setFontSize}
                            setFontFamily={setFontFamily}
                            setTheme={setTheme}
                            allThemes={allThemes}
                            supportedFonts={supportedFonts}
                        />
                    )}

                    {activeMenu === "navigation" && !isLoading && (
                        <NavigationMenu
                            toc={toc}
                            currentPage={currentBookPage}
                            totalPages={totalBookPages}
                            onClose={() => setActiveMenu("none")}
                            onGoToPage={(page) => bookComponentRef.current?.goToPage(page)}
                            onChapterClick={(href) => bookComponentRef.current?.findAndJumpToHref(href)}
                        />
                    )}

                    {activeMenu === "highlights" && !isLoading && (
                        <HighlightsMenu
                            highlights={highlights}
                            onClose={() => setActiveMenu("none")}
                            onGoToPage={(page) => bookComponentRef.current?.goToPage(page)}
                            onRemoveHighlight={handleRemoveHighlight}
                            onUpdateHighlightColor={handleUpdateHighlightColor}
                        />
                    )}

                    {activeMenu === "none" && !showTutorial && !isLoading && (
                        <div className="bottom-interaction-layer">
                            <div
                                className="trigger-zone"
                                onClick={() => setActiveMenu("highlights")}
                                aria-label="Open Highlights"
                            />

                            <div
                                className="trigger-zone"
                                onClick={() => setActiveMenu("navigation")}
                                aria-label="Open Navigation"
                            />

                            <div
                                className="trigger-zone"
                                onClick={() => setActiveMenu("options")}
                                aria-label="Open Settings"
                            />

                            <div
                                className="settings-icon"
                                onClick={() => setActiveMenu("options")}
                                aria-label="Open Settings"
                            >
                                <Settings size={16} />
                            </div>

                            <div
                                className="highlights-icon"
                                aria-label="Highlights"
                            >
                                <Highlighter size={16} />
                            </div>
                        </div>
                    )}
                </>
            )}
            {!epubDataSource && !isLoading && !error && (
                <div style={{ padding: "20px", textAlign: "center" }}>
                    No EPUB loaded.
                </div>
            )}
        </div>
    );
});

BokReader.displayName = "BokReader";

export default BokReader;
