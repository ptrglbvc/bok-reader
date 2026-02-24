import React, {
    useState,
    useRef,
    useEffect,
    useLayoutEffect,
    Dispatch,
    SetStateAction,
    useCallback,
    useImperativeHandle,
    forwardRef,
    memo
} from "react";
import usePage from "../hooks/usePage";
import usePercentageRead from "../hooks/usePercentageRead";
import useNavigation from "../hooks/useNavigation";
import PageNumber from "./PageNumber/PageNumber";
import { calculatePageOfElement } from "../helpful_functions/calculatePageOfElement";
import Toast from "./Toast/Toast";

export interface BookHandle {
    goToPage: (page: number) => void;
    findAndJumpToHref: (href: string) => void;
    setProgress: (progress: number) => void;
    getProgress: () => number;
}

export type HighlightColor = "yellow" | "red" | "blue" | "purple";

export type Highlight = {
    id: string;
    chapterId: string;
    start: number;
    end: number;
    color: HighlightColor;
    text?: string;
};

type VerticalPlacement = "above" | "below";

type HighlightMenuPosition = {
    left: number;
    anchorLeft: number;
    top: number;
    anchorTop: number;
    anchorBottom: number;
    placement: VerticalPlacement;
};

type HighlightActionMenuPosition = HighlightMenuPosition & {
    id: string;
};

const MENU_VERTICAL_GAP = 12;
const MENU_HORIZONTAL_GAP = 12;
const SELECTION_MENU_ESTIMATED_HEIGHT = 44;
const ACTION_MENU_ESTIMATED_HEIGHT = 94;
const SELECTION_MENU_ESTIMATED_WIDTH = 135;
const ACTION_MENU_ESTIMATED_WIDTH = 180;

const getMenuTopPosition = ({
    anchorTop,
    anchorBottom,
    containerHeight,
    menuHeight
}: {
    anchorTop: number;
    anchorBottom: number;
    containerHeight: number;
    menuHeight: number;
}): { top: number; placement: VerticalPlacement } => {
    if (anchorTop - MENU_VERTICAL_GAP >= menuHeight) {
        return {
            top: Math.max(MENU_VERTICAL_GAP, anchorTop - menuHeight - MENU_VERTICAL_GAP),
            placement: "above"
        };
    }

    const maxTop = Math.max(MENU_VERTICAL_GAP, containerHeight - menuHeight - MENU_VERTICAL_GAP);
    return {
        top: Math.min(maxTop, anchorBottom + MENU_VERTICAL_GAP),
        placement: "below"
    };
};

const getMenuLeftPosition = ({
    anchorLeft,
    containerWidth,
    menuWidth
}: {
    anchorLeft: number;
    containerWidth: number;
    menuWidth: number;
}): number => {
    const minLeft = menuWidth / 2 + MENU_HORIZONTAL_GAP;
    const maxLeft = Math.max(minLeft, containerWidth - menuWidth / 2 - MENU_HORIZONTAL_GAP);
    return Math.max(minLeft, Math.min(maxLeft, anchorLeft));
};

const BookContent = memo(
    ({ content, bookRef }: { content: string; bookRef: React.RefObject<HTMLDivElement> }) => (
        <div
            ref={bookRef}
            dangerouslySetInnerHTML={{ __html: content }}
            className="book-page"
            id="bok-main-element"
        ></div>
    ),
    (prev, next) => prev.content === next.content,
);

interface PageProps {
    content: string;
    title: string;
    bookId: string;
    setIsLoading: Dispatch<SetStateAction<boolean>>;
    fontSize: number;
    fontFamily: string;
    sidePadding: number;
    showTutorial: boolean;
    isOptionMenuVisible: boolean;
    containerElementRef: React.RefObject<HTMLDivElement | null>;
    onPageChange?: (page: number) => void;
    onPageCountChange?: (count: number) => void;
    onProgressChange?: (progress: number) => void;
    highlights: Highlight[];
    onAddHighlight: (highlight: Highlight) => void;
    onRemoveHighlight: (id: string) => void;
    onUpdateHighlightColor: (id: string, color: HighlightColor) => void;
}

const easeOutBack = (x: number): number => {
    const c1 = 0.7;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

// 3. Use forwardRef
const Book = forwardRef<BookHandle, PageProps>(({
    content,
    title,
    bookId,
    setIsLoading,
    fontSize,
    sidePadding,
    fontFamily,
    isOptionMenuVisible,
    containerElementRef,
    showTutorial,
    onPageChange,
    onPageCountChange,
    onProgressChange,
    highlights,
    onAddHighlight,
    onRemoveHighlight,
    onUpdateHighlightColor
}, ref) => {
    const bookRef = useRef<HTMLDivElement>(null);
    const initialLoadDoneRef = useRef(false);
    const selectionRangeRef = useRef<Range | null>(null);
    const selectionMenuTimestampRef = useRef<number>(0);
    const suppressSelectionClearUntilRef = useRef(0);
    const ignoreDocumentClickUntilRef = useRef(0);
    const selectionMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const highlightMenuRef = useRef<HTMLDivElement>(null);
    const highlightActionMenuRef = useRef<HTMLDivElement>(null);
    const [highlightMenuPosition, setHighlightMenuPosition] = useState<HighlightMenuPosition | null>(null);
    const [highlightActionMenu, setHighlightActionMenu] = useState<HighlightActionMenuPosition | null>(null);
    const [isCopyToastVisible, setIsCopyToastVisible] = useState(false);
    const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [pageWidth, pageHeight, noOfPages] = usePage(containerElementRef);
    const [percentRead, setPercentRead] = usePercentageRead(bookRef);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageCount, setPageCount] = useState(0);
    const skipProgressPersistRef = useRef(false);
    const progressStorageKey = bookId ? `bok_progress_${bookId}` : "";
    const legacyProgressStorageKey = title && title !== "Loading..."
        ? `bok_progress_${title}`
        : "";

    const percentReadRef = useRef(percentRead);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        if (onPageCountChange) onPageCountChange(pageCount);
    }, [pageCount, onPageCountChange]);

    useEffect(() => {
        if (onPageChange) onPageChange(currentPage);
    }, [currentPage, onPageChange]);

    useEffect(() => {
        percentReadRef.current = percentRead;
    }, [percentRead]);

    useEffect(() => {
        if (!progressStorageKey) return;
        let restoredProgress = 0;

        try {
            const stored = localStorage.getItem(progressStorageKey);
            if (stored !== null) {
                const parsed = JSON.parse(stored);
                if (typeof parsed === "number" && Number.isFinite(parsed)) {
                    restoredProgress = Math.max(0, Math.min(1, parsed));
                }
            } else if (legacyProgressStorageKey) {
                const legacyStored = localStorage.getItem(legacyProgressStorageKey);
                if (legacyStored !== null) {
                    const parsedLegacy = JSON.parse(legacyStored);
                    if (typeof parsedLegacy === "number" && Number.isFinite(parsedLegacy)) {
                        restoredProgress = Math.max(0, Math.min(1, parsedLegacy));
                        localStorage.setItem(progressStorageKey, JSON.stringify(restoredProgress));
                    }
                }
            }
        } catch (error) {
            console.warn(`Error restoring progress for "${progressStorageKey}":`, error);
        }

        skipProgressPersistRef.current = true;
        setPercentRead(restoredProgress);
        const clearSkipTimer = setTimeout(() => {
            skipProgressPersistRef.current = false;
        }, 0);

        return () => clearTimeout(clearSkipTimer);
    }, [legacyProgressStorageKey, progressStorageKey, setPercentRead]);

    useEffect(() => {
        if (!progressStorageKey) return;
        if (skipProgressPersistRef.current) return;

        try {
            localStorage.setItem(progressStorageKey, JSON.stringify(percentRead));
        } catch (error) {
            console.warn(`Error saving progress for "${progressStorageKey}":`, error);
        }
    }, [percentRead, progressStorageKey]);

    useEffect(() => {
        if (onProgressChange) {
            onProgressChange(percentRead);
        }
    }, [onProgressChange, percentRead]);


    // --- ANIMATION & NAVIGATION LOGIC ---
    const performScrollAnimation = useCallback((targetPage: number) => {
        const scrollContainer = bookRef.current;
        if (!scrollContainer) return;

        if (animationRef.current) cancelAnimationFrame(animationRef.current);

        const start = scrollContainer.scrollLeft;
        const target = targetPage * pageWidth * noOfPages;
        const distance = target - start;
        const duration = 450;
        const startTime = performance.now();

        const animateScroll = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            if (elapsed < duration) {
                const ease = easeOutBack(elapsed / duration);
                scrollContainer.scrollLeft = start + distance * ease;
                animationRef.current = requestAnimationFrame(animateScroll);
            } else {
                scrollContainer.scrollLeft = target;
                animationRef.current = null;
            }
        };
        animationRef.current = requestAnimationFrame(animateScroll);
    }, [pageWidth, noOfPages]);

    const goToPage = useCallback((targetPage: number) => {
        let safePage = targetPage;
        if (safePage < 0) safePage = 0;
        if (safePage >= pageCount) safePage = pageCount - 1;

        setCurrentPage(safePage);
        performScrollAnimation(safePage);
    }, [pageCount, performScrollAnimation]);

    const setProgress = useCallback((progress: number) => {
        const clampedProgress = Math.max(0, Math.min(1, progress));
        setPercentRead(clampedProgress);

        if (pageCount <= 0) return;
        let targetPage = Math.round(pageCount * clampedProgress);
        targetPage = Math.max(0, Math.min(pageCount - 1, targetPage));
        setCurrentPage(targetPage);
        performScrollAnimation(targetPage);
    }, [pageCount, performScrollAnimation, setPercentRead]);

    const changePage = useCallback((amount: number) => {
        setCurrentPage((prev) => {
            let newValue = prev + amount;
            if (newValue < 0) newValue = 0;
            if (newValue >= pageCount) newValue = pageCount - 1;
            performScrollAnimation(newValue);
            return newValue;
        });
    }, [pageCount, performScrollAnimation]);

    // 4. Expose methods via ref
    useImperativeHandle(ref, () => ({
        goToPage,
        setProgress,
        getProgress: () => percentReadRef.current,
        findAndJumpToHref: (href: string) => {
            const elementId = href.startsWith("#") ? href.substring(1) : href;
            const targetElement = document.getElementById(elementId);
            if (targetElement) {
                try {
                    const targetPage = calculatePageOfElement(targetElement);
                    goToPage(targetPage);
                } catch (err) {
                    console.warn("Could not calculate page for link", err);
                }
            }
        }
    }), [goToPage, setProgress]);

    const isInteractionMenuVisible = Boolean(
        isOptionMenuVisible || highlightMenuPosition || highlightActionMenu
    );

    useNavigation(
        changePage,
        isInteractionMenuVisible,
        containerElementRef,
        showTutorial,
    );

    const escapeId = useCallback((value: string) => {
        if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
        return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    }, []);

    const getChapterElement = useCallback((node: Node | null): HTMLElement | null => {
        if (!node) return null;
        if (node.nodeType === Node.ELEMENT_NODE) {
            return (node as Element).closest(".bok-chapter") as HTMLElement | null;
        }
        return node.parentElement?.closest(".bok-chapter") as HTMLElement | null;
    }, []);

    const createTextNodeWalker = useCallback((chapter: Element) => {
        return document.createTreeWalker(
            chapter,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (!node.nodeValue || node.nodeValue.length === 0) return NodeFilter.FILTER_REJECT;
                    const parent = (node as Text).parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    const tag = parent.tagName.toLowerCase();
                    if (tag === "script" || tag === "style") return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );
    }, []);

    const getTextNodes = useCallback((chapter: Element) => {
        const walker = createTextNodeWalker(chapter);
        const nodes: Text[] = [];
        let currentNode = walker.nextNode();
        while (currentNode) {
            nodes.push(currentNode as Text);
            currentNode = walker.nextNode();
        }
        return nodes;
    }, [createTextNodeWalker]);

    const getOffsetWithinChapter = useCallback((
        chapter: Element,
        container: Node,
        offset: number
    ) => {
        const range = document.createRange();
        range.selectNodeContents(chapter);
        try {
            range.setEnd(container, offset);
        } catch {
            return 0;
        }

        let total = 0;
        const walker = createTextNodeWalker(chapter);
        let currentNode = walker.nextNode();

        while (currentNode) {
            const textNode = currentNode as Text;
            const startCmp = range.comparePoint(textNode, 0);
            if (startCmp === 1) break;
            const endCmp = range.comparePoint(textNode, textNode.length);
            if (endCmp === 0) {
                total += textNode.length;
            } else if (endCmp === 1) {
                try {
                    const partialRange = document.createRange();
                    partialRange.setStart(textNode, 0);
                    partialRange.setEnd(range.endContainer, range.endOffset);
                    const partialLength = partialRange.toString().length;
                    total += Math.max(0, Math.min(partialLength, textNode.length));
                } catch {
                    total += 0;
                }
                break;
            }
            currentNode = walker.nextNode();
        }

        return total;
    }, [createTextNodeWalker]);

    const wrapTextRange = useCallback((textNode: Text, start: number, end: number, highlight: Highlight) => {
        if (start >= end) return;
        let targetNode = textNode;
        if (start > 0) {
            targetNode = textNode.splitText(start);
        }
        if (end < targetNode.length) {
            targetNode.splitText(end - start);
        }

        const span = document.createElement("span");
        span.setAttribute("data-highlight-id", highlight.id);
        span.setAttribute("data-highlight-color", highlight.color);
        span.className = `bok-highlight bok-highlight--${highlight.color}`;

        const parent = targetNode.parentNode;
        if (!parent) return;
        parent.insertBefore(span, targetNode);
        span.appendChild(targetNode);
    }, []);

    const applyHighlightToChapter = useCallback((chapter: Element, highlight: Highlight) => {
        if (highlight.end <= highlight.start) return;

        const nodes = getTextNodes(chapter);
        let total = 0;

        for (const textNode of nodes) {
            const nodeLength = textNode.length;
            const nodeStart = total;
            const nodeEnd = total + nodeLength;

            if (nodeEnd <= highlight.start) {
                total += nodeLength;
                continue;
            }

            if (nodeStart >= highlight.end) break;

            const start = Math.max(highlight.start, nodeStart) - nodeStart;
            const end = Math.min(highlight.end, nodeEnd) - nodeStart;
            wrapTextRange(textNode, start, end, highlight);

            total += nodeLength;
        }
    }, [getTextNodes, wrapTextRange]);

    const renderHighlights = useCallback(() => {
        const container = bookRef.current;
        if (!container) return;

        const existingHighlights = container.querySelectorAll("span[data-highlight-id]");
        existingHighlights.forEach((span) => {
            const parent = span.parentNode;
            if (!parent) return;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
        });

        const chapters = container.querySelectorAll(".bok-chapter");
        chapters.forEach((chapter) => chapter.normalize());

        if (!highlights || highlights.length === 0) return;

        for (const highlight of highlights) {
            if (!highlight.chapterId) continue;
            const chapter = container.querySelector(`#${escapeId(highlight.chapterId)}`);
            if (!chapter) continue;
            applyHighlightToChapter(chapter, highlight);
        }
    }, [applyHighlightToChapter, escapeId, highlights]);


    const showHighlightMenu = useCallback(() => {
        if (isOptionMenuVisible || showTutorial) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            setHighlightMenuPosition(null);
            selectionRangeRef.current = null;
            return;
        }

        const range = selection.getRangeAt(0);
        const container = bookRef.current;
        if (!container || !container.contains(range.commonAncestorContainer)) {
            setHighlightMenuPosition(null);
            selectionRangeRef.current = null;
            return;
        }

        setHighlightActionMenu(null);

        const startChapter = getChapterElement(range.startContainer);
        const endChapter = getChapterElement(range.endContainer);
        if (!startChapter || !endChapter || startChapter !== endChapter) {
            setHighlightMenuPosition(null);
            selectionRangeRef.current = null;
            return;
        }

        const containerRect = containerElementRef.current?.getBoundingClientRect();
        let rangeRect = range.getBoundingClientRect();
        if (rangeRect.width === 0 && rangeRect.height === 0) {
            const rects = Array.from(range.getClientRects());
            if (rects.length > 0) {
                rangeRect = rects[0];
            }
        }
        if (!containerRect || (rangeRect.width === 0 && rangeRect.height === 0)) return;

        const anchorLeft = rangeRect.left + rangeRect.width / 2 - containerRect.left;
        const left = getMenuLeftPosition({
            anchorLeft,
            containerWidth: containerRect.width,
            menuWidth: SELECTION_MENU_ESTIMATED_WIDTH
        });
        const anchorTop = rangeRect.top - containerRect.top;
        const anchorBottom = rangeRect.bottom - containerRect.top;
        const { top, placement } = getMenuTopPosition({
            anchorTop,
            anchorBottom,
            containerHeight: containerRect.height,
            menuHeight: SELECTION_MENU_ESTIMATED_HEIGHT
        });

        selectionRangeRef.current = range.cloneRange();
        selectionMenuTimestampRef.current = Date.now();
        setHighlightMenuPosition({ left, anchorLeft, top, anchorTop, anchorBottom, placement });

    }, [containerElementRef, getChapterElement, isOptionMenuVisible, showTutorial]);

    const handleHighlightColor = useCallback((color: HighlightColor) => {
        const range = selectionRangeRef.current;
        if (!range) return;

        const startChapter = getChapterElement(range.startContainer);
        const endChapter = getChapterElement(range.endContainer);
        if (!startChapter || !endChapter || startChapter !== endChapter) {
            setHighlightMenuPosition(null);
            selectionRangeRef.current = null;
            return;
        }

        const chapterId = startChapter.id;
        if (!chapterId) {
            setHighlightMenuPosition(null);
            selectionRangeRef.current = null;
            return;
        }

        const start = getOffsetWithinChapter(startChapter, range.startContainer, range.startOffset);
        const end = getOffsetWithinChapter(startChapter, range.endContainer, range.endOffset);
        if (end <= start) {
            setHighlightMenuPosition(null);
            selectionRangeRef.current = null;
            return;
        }

        const highlightText = range.toString().trim();
        const highlight: Highlight = {
            id: (typeof crypto !== "undefined" && "randomUUID" in crypto)
                ? crypto.randomUUID()
                : `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            chapterId,
            start,
            end,
            color,
            text: highlightText || undefined
        };

        onAddHighlight(highlight);
        setHighlightMenuPosition(null);
        selectionRangeRef.current = null;
        window.getSelection()?.removeAllRanges();
    }, [getChapterElement, getOffsetWithinChapter, onAddHighlight]);

    const getHighlightText = useCallback((highlight: Highlight) => {
        if (highlight.text) return highlight.text;
        const container = bookRef.current;
        if (!container) return "";
        const chapter = container.querySelector(`#${escapeId(highlight.chapterId)}`);
        if (!chapter) return "";
        if (highlight.end <= highlight.start) return "";

        const nodes = getTextNodes(chapter);
        let total = 0;
        let result = "";

        for (const textNode of nodes) {
            const nodeLength = textNode.length;
            const nodeStart = total;
            const nodeEnd = total + nodeLength;

            if (nodeEnd <= highlight.start) {
                total += nodeLength;
                continue;
            }

            if (nodeStart >= highlight.end) break;

            const start = Math.max(highlight.start, nodeStart) - nodeStart;
            const end = Math.min(highlight.end, nodeEnd) - nodeStart;
            result += textNode.data.slice(start, end);

            total += nodeLength;
        }

        return result;
    }, [escapeId, getTextNodes]);

    const copyTextToClipboard = useCallback(async (text: string) => {
        if (!text) return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return;
            }
        } catch {
            // fallback below
        }

        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand("copy");
        } catch (err) {
            console.warn("Copy failed:", err);
        } finally {
            document.body.removeChild(textarea);
        }
    }, []);

    useEffect(() => {
        renderHighlights();
    }, [renderHighlights, content]);

    useEffect(() => {
        const container = bookRef.current;
        if (!container) return;

        const handleMouseUp = () => {
            showHighlightMenu();
        };
        const handleTouchEnd = () => {
            const isCoarsePointer = typeof window !== "undefined" && (
                window.matchMedia?.("(pointer: coarse)")?.matches ||
                navigator.maxTouchPoints > 0
            );
            if (isCoarsePointer) return;
            setTimeout(showHighlightMenu, 0);
        };

        container.addEventListener("mouseup", handleMouseUp);
        container.addEventListener("touchend", handleTouchEnd);

        return () => {
            container.removeEventListener("mouseup", handleMouseUp);
            container.removeEventListener("touchend", handleTouchEnd);
        };
    }, [showHighlightMenu]);

    useEffect(() => {
        const container = bookRef.current;
        if (!container) return;
        const handleContextMenu = (event: MouseEvent) => {
            event.preventDefault();
        };
        container.addEventListener("contextmenu", handleContextMenu);
        return () => container.removeEventListener("contextmenu", handleContextMenu);
    }, []);

    useEffect(() => {
        const handleSelectionChange = () => {
            if (Date.now() < suppressSelectionClearUntilRef.current) {
                return;
            }
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                const isCoarsePointer = typeof window !== "undefined" && (
                    window.matchMedia?.("(pointer: coarse)")?.matches ||
                    navigator.maxTouchPoints > 0
                );
                if (isCoarsePointer) {
                    if (selectionMenuTimerRef.current) {
                        clearTimeout(selectionMenuTimerRef.current);
                    }
                    selectionMenuTimerRef.current = setTimeout(() => {
                        selectionMenuTimerRef.current = null;
                        showHighlightMenu();
                    }, 250);
                    return;
                }
            }

            if (!selection || selection.isCollapsed) {
                if (selectionMenuTimerRef.current) {
                    clearTimeout(selectionMenuTimerRef.current);
                    selectionMenuTimerRef.current = null;
                }
                setHighlightMenuPosition(null);
                selectionRangeRef.current = null;
            }
        };
        document.addEventListener("selectionchange", handleSelectionChange);
        return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, [showHighlightMenu]);

    useEffect(() => {
        return () => {
            if (copyToastTimerRef.current) {
                clearTimeout(copyToastTimerRef.current);
            }
            if (selectionMenuTimerRef.current) {
                clearTimeout(selectionMenuTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (isOptionMenuVisible || showTutorial) {
            setHighlightMenuPosition(null);
            selectionRangeRef.current = null;
            setHighlightActionMenu(null);
        }
    }, [isOptionMenuVisible, showTutorial]);

    useLayoutEffect(() => {
        if (!highlightMenuPosition) return;
        const containerRect = containerElementRef.current?.getBoundingClientRect();
        if (!containerRect) return;
        const menuHeight = highlightMenuRef.current?.offsetHeight ?? SELECTION_MENU_ESTIMATED_HEIGHT;
        const menuWidth = highlightMenuRef.current?.offsetWidth ?? SELECTION_MENU_ESTIMATED_WIDTH;
        const { top, placement } = getMenuTopPosition({
            anchorTop: highlightMenuPosition.anchorTop,
            anchorBottom: highlightMenuPosition.anchorBottom,
            containerHeight: containerRect.height,
            menuHeight
        });
        const left = getMenuLeftPosition({
            anchorLeft: highlightMenuPosition.anchorLeft,
            containerWidth: containerRect.width,
            menuWidth
        });
        if (
            Math.abs(left - highlightMenuPosition.left) > 0.5 ||
            Math.abs(top - highlightMenuPosition.top) > 0.5 ||
            placement !== highlightMenuPosition.placement
        ) {
            setHighlightMenuPosition((previous) => (
                previous
                    ? { ...previous, left, top, placement }
                    : previous
            ));
        }
    }, [containerElementRef, highlightMenuPosition]);

    useEffect(() => {
        const container = bookRef.current;
        if (!container) return;
        const handleHighlightClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const highlight = target.closest("span[data-highlight-id]") as HTMLElement | null;
            if (!highlight) return;
            event.preventDefault();
            event.stopPropagation();
            setHighlightMenuPosition(null);
            selectionRangeRef.current = null;
            const id = highlight.getAttribute("data-highlight-id");
            if (!id) return;
            const containerRect = containerElementRef.current?.getBoundingClientRect();
            const highlightRect = highlight.getBoundingClientRect();
            if (!containerRect) return;
            const anchorLeft = highlightRect.left + highlightRect.width / 2 - containerRect.left;
            const left = getMenuLeftPosition({
                anchorLeft,
                containerWidth: containerRect.width,
                menuWidth: ACTION_MENU_ESTIMATED_WIDTH
            });
            const anchorTop = highlightRect.top - containerRect.top;
            const anchorBottom = highlightRect.bottom - containerRect.top;
            const { top, placement } = getMenuTopPosition({
                anchorTop,
                anchorBottom,
                containerHeight: containerRect.height,
                menuHeight: ACTION_MENU_ESTIMATED_HEIGHT
            });
            setHighlightActionMenu({ id, left, anchorLeft, top, anchorTop, anchorBottom, placement });
            window.getSelection()?.removeAllRanges();
        };
        container.addEventListener("click", handleHighlightClick);
        return () => container.removeEventListener("click", handleHighlightClick);
    }, [containerElementRef]);

    useLayoutEffect(() => {
        if (!highlightActionMenu) return;
        const containerRect = containerElementRef.current?.getBoundingClientRect();
        if (!containerRect) return;
        const menuHeight = highlightActionMenuRef.current?.offsetHeight ?? ACTION_MENU_ESTIMATED_HEIGHT;
        const menuWidth = highlightActionMenuRef.current?.offsetWidth ?? ACTION_MENU_ESTIMATED_WIDTH;
        const { top, placement } = getMenuTopPosition({
            anchorTop: highlightActionMenu.anchorTop,
            anchorBottom: highlightActionMenu.anchorBottom,
            containerHeight: containerRect.height,
            menuHeight
        });
        const left = getMenuLeftPosition({
            anchorLeft: highlightActionMenu.anchorLeft,
            containerWidth: containerRect.width,
            menuWidth
        });
        if (
            Math.abs(left - highlightActionMenu.left) > 0.5 ||
            Math.abs(top - highlightActionMenu.top) > 0.5 ||
            placement !== highlightActionMenu.placement
        ) {
            setHighlightActionMenu((previous) => (
                previous
                    ? { ...previous, left, top, placement }
                    : previous
            ));
        }
    }, [containerElementRef, highlightActionMenu]);

    useEffect(() => {
        const container = bookRef.current;
        if (!container) return;

        const highlightSpans = container.querySelectorAll("span[data-highlight-id]");
        highlightSpans.forEach((span) => span.classList.remove("bok-highlight--focused"));

        if (!highlightActionMenu) return;

        highlightSpans.forEach((span) => {
            if (span.getAttribute("data-highlight-id") === highlightActionMenu.id) {
                span.classList.add("bok-highlight--focused");
            }
        });
    }, [highlightActionMenu, highlights]);

    useEffect(() => {
        const handleDocumentClick = (event: MouseEvent) => {
            if (Date.now() < ignoreDocumentClickUntilRef.current) return;
            const target = event.target as HTMLElement;
            if (target.closest(".highlight-menu") || target.closest(".highlight-action-menu")) return;
            if (target.closest("span[data-highlight-id]")) return;
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && highlightMenuPosition) return;
            if (Date.now() - selectionMenuTimestampRef.current < 200) return;
            setHighlightMenuPosition(null);
            setHighlightActionMenu(null);
        };
        document.addEventListener("click", handleDocumentClick);
        return () => document.removeEventListener("click", handleDocumentClick);
    }, [highlightMenuPosition]);

    // --- LINK INTERCEPTION ---
    useEffect(() => {
        const container = bookRef.current;
        if (!container) return;
        const handleLinkClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest("a");
            if (anchor && anchor.getAttribute("href")?.startsWith("#")) {
                e.preventDefault();
                const rawHref = anchor.getAttribute("href")!;
                const elementId = decodeURIComponent(rawHref.substring(1));
                const targetElement = document.getElementById(elementId);
                if (targetElement) {
                    try {
                        const targetPage = calculatePageOfElement(targetElement);
                        goToPage(targetPage);
                    } catch (err) {
                        console.warn("Could not calculate page for link", err);
                    }
                }
            }
        };
        container.addEventListener("click", handleLinkClick);
        return () => container.removeEventListener("click", handleLinkClick);
    }, [goToPage]);

    // --- LAYOUT & RESIZE ---
    useEffect(() => {
        const currentBookRef = bookRef.current;
        if (!currentBookRef || pageWidth <= 0 || pageHeight <= 0) return;
        setIsLoading(true);
        const timer = setTimeout(() => {
            currentBookRef.style.setProperty("--side-padding", `${sidePadding}px`);
            currentBookRef.style.setProperty("--font-size", `${fontSize}em`);
            currentBookRef.style.setProperty("--font-family", fontFamily);
            currentBookRef.style.setProperty("--computed-width", `${pageWidth}px`);
            currentBookRef.style.maxHeight = `${pageHeight}px`;
            void currentBookRef.offsetHeight; // Force reflow
            requestAnimationFrame(() => {
                if (!currentBookRef) return;
                const totalWidth = currentBookRef.scrollWidth;
                const newPageCount = pageWidth > 0 && totalWidth > 0
                    ? Math.round(totalWidth / pageWidth)
                    : 0;
                const noOfWholePages = noOfPages === 1 ? newPageCount : Math.round(newPageCount / 2);
                setPageCount(noOfWholePages);
                if (noOfWholePages > 0 && currentBookRef.clientWidth > 0) {
                    const currentPercent = percentReadRef.current;
                    let targetPage = Math.round(noOfWholePages * currentPercent);
                    targetPage = Math.max(0, Math.min(noOfWholePages - 1, targetPage));
                    setCurrentPage(targetPage);
                    currentBookRef.scrollLeft = targetPage * pageWidth * noOfPages;
                } else {
                    setCurrentPage(1);
                }
                setIsLoading(false);
                if (!initialLoadDoneRef.current) {
                    initialLoadDoneRef.current = true;
                    document.getElementById("root")?.dispatchEvent(new CustomEvent("react-ready"));
                }
            });
        }, 400);
        return () => {
            clearTimeout(timer);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [pageWidth, pageHeight, sidePadding, fontSize, fontFamily, noOfPages, content, title, setIsLoading]);


    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                changePage(-1);
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                changePage(1);
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [changePage]);

    const activeHighlight = highlightActionMenu
        ? highlights.find((item) => item.id === highlightActionMenu.id)
        : null;

    const triggerCopyToast = useCallback(() => {
        setIsCopyToastVisible(false);
        requestAnimationFrame(() => setIsCopyToastVisible(true));

        if (copyToastTimerRef.current) {
            clearTimeout(copyToastTimerRef.current);
        }
        copyToastTimerRef.current = setTimeout(() => {
            setIsCopyToastVisible(false);
        }, 1600);
    }, []);

    return (
        <>
            <BookContent content={content} bookRef={bookRef} />
            {highlightMenuPosition && !isOptionMenuVisible && !showTutorial && (
                <div
                    ref={highlightMenuRef}
                    className="highlight-menu"
                    data-placement={highlightMenuPosition.placement}
                    style={{
                        left: `${highlightMenuPosition.left}px`,
                        top: `${highlightMenuPosition.top}px`
                    }}
                    role="menu"
                    aria-label="Highlight colors"
                >
                    <button
                        type="button"
                        className="highlight-swatch highlight-swatch--yellow"
                        onClick={() => handleHighlightColor("yellow")}
                        aria-label="Highlight yellow"
                    />
                    <button
                        type="button"
                        className="highlight-swatch highlight-swatch--red"
                        onClick={() => handleHighlightColor("red")}
                        aria-label="Highlight red"
                    />
                    <button
                        type="button"
                        className="highlight-swatch highlight-swatch--blue"
                        onClick={() => handleHighlightColor("blue")}
                        aria-label="Highlight blue"
                    />
                    <button
                        type="button"
                        className="highlight-swatch highlight-swatch--purple"
                        onClick={() => handleHighlightColor("purple")}
                        aria-label="Highlight purple"
                    />
                </div>
            )}
            {highlightActionMenu && activeHighlight && !isOptionMenuVisible && !showTutorial && (
                <div
                    ref={highlightActionMenuRef}
                    className="highlight-action-menu"
                    data-placement={highlightActionMenu.placement}
                    style={{
                        left: `${highlightActionMenu.left}px`,
                        top: `${highlightActionMenu.top}px`
                    }}
                    role="menu"
                    aria-label="Highlight actions"
                >
                    <div className="highlight-swatch-row">
                        {activeHighlight && (
                            <>
                                <button
                                    type="button"
                                    className={`highlight-swatch highlight-swatch--yellow${activeHighlight.color === "yellow" ? " highlight-swatch--active" : ""}`}
                                    onClick={() => {
                                        onUpdateHighlightColor(activeHighlight.id, "yellow");
                                        setHighlightActionMenu(null);
                                    }}
                                    aria-label="Change highlight to yellow"
                                />
                                <button
                                    type="button"
                                    className={`highlight-swatch highlight-swatch--red${activeHighlight.color === "red" ? " highlight-swatch--active" : ""}`}
                                    onClick={() => {
                                        onUpdateHighlightColor(activeHighlight.id, "red");
                                        setHighlightActionMenu(null);
                                    }}
                                    aria-label="Change highlight to red"
                                />
                                <button
                                    type="button"
                                    className={`highlight-swatch highlight-swatch--blue${activeHighlight.color === "blue" ? " highlight-swatch--active" : ""}`}
                                    onClick={() => {
                                        onUpdateHighlightColor(activeHighlight.id, "blue");
                                        setHighlightActionMenu(null);
                                    }}
                                    aria-label="Change highlight to blue"
                                />
                                <button
                                    type="button"
                                    className={`highlight-swatch highlight-swatch--purple${activeHighlight.color === "purple" ? " highlight-swatch--active" : ""}`}
                                    onClick={() => {
                                        onUpdateHighlightColor(activeHighlight.id, "purple");
                                        setHighlightActionMenu(null);
                                    }}
                                    aria-label="Change highlight to purple"
                                />
                            </>
                        )}
                    </div>
                    <div className="highlight-action-row">
                        <button
                            type="button"
                            className="highlight-action-button"
                            onClick={async () => {
                                if (activeHighlight) {
                                    const text = getHighlightText(activeHighlight);
                                    await copyTextToClipboard(text);
                                    triggerCopyToast();
                                }
                                setHighlightActionMenu(null);
                            }}
                        >
                            Copy
                        </button>
                        <button
                            type="button"
                            className="highlight-action-button highlight-action-button--danger"
                            onClick={() => {
                                onRemoveHighlight(activeHighlight.id);
                                setHighlightActionMenu(null);
                            }}
                        >
                            Remove
                        </button>
                    </div>
                </div>
            )}
            <Toast message="Copied to clipboard" visible={isCopyToastVisible} />
            <PageNumber pages={pageCount} currentPage={currentPage} />
        </>
    );
});

export default Book;
