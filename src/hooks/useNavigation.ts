import { useCallback, useEffect, useRef } from "react";
import usePage from "./usePage";

const useNavigation = (
    changePage: (n: number) => void,
    isOptionMenuVisible: boolean,
    containerElementRef: React.RefObject<HTMLDivElement | null>,
    showTutorial: boolean,
) => {
    const [pageWidth, pageHeight] = usePage(containerElementRef);
    const longPressTimerRef = useRef<null | number>(null);
    const selectedText = useRef("");
    const selectionActiveRef = useRef(false);
    const selectionAtPointerDownRef = useRef(false);
    const selectionClearedAtRef = useRef(0);
    const selectionBlockUntilRef = useRef(0);
    const touchStartPointRef = useRef<{ x: number; y: number } | null>(null);

    const handlePageClick = useCallback(
        (tapWidth: number, tapHeight: number) => {
            const selection = window.getSelection();
            const hasSelection = selectionActiveRef.current || Boolean(
                selection &&
                selection.rangeCount > 0 &&
                !selection.isCollapsed
            );
            if (Date.now() < selectionBlockUntilRef.current) return false;
            const clearedRecently =
                !hasSelection &&
                selectionClearedAtRef.current > 0 &&
                Date.now() - selectionClearedAtRef.current < 500;
            if (clearedRecently) return false;
            if (hasSelection) return false;

            if (!isOptionMenuVisible && !showTutorial) {
                if (
                    tapWidth / pageWidth <= 0.4 &&
                    tapHeight / pageHeight < 0.8
                ) {
                    changePage(-1);
                    return true;
                }
                if (
                    tapWidth / pageWidth > 0.4 &&
                    tapHeight / pageHeight < 0.8
                ) {
                    changePage(1);
                    return true;
                }
            }
            return false;
        },
        [changePage, isOptionMenuVisible, pageWidth, pageHeight, showTutorial],
    );

    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            const hasSelection = Boolean(
                selection &&
                selection.rangeCount > 0 &&
                !selection.isCollapsed
            );
            if (!hasSelection && selectionActiveRef.current) {
                selectionClearedAtRef.current = Date.now();
            }
            selectionActiveRef.current = hasSelection;
            if (!hasSelection) {
                selectionAtPointerDownRef.current = false;
            }
            selectedText.current = hasSelection ? selection?.toString() ?? "" : "";
            if (hasSelection) {
                selectionBlockUntilRef.current = Date.now() + 1500;
            } else if (selectionClearedAtRef.current) {
                selectionBlockUntilRef.current = Date.now() + 500;
            }
        };
        document.addEventListener("selectionchange", handleSelection);
        return () => {
            document.removeEventListener("selectionchange", handleSelection);
        };
    }, []);

    // --- TOUCH EVENTS ---
    useEffect(() => {
        const handleTouchStart = (event: TouchEvent) => {
            const selection = window.getSelection();
            selectionAtPointerDownRef.current = selectionActiveRef.current || Boolean(
                selection &&
                selection.rangeCount > 0 &&
                !selection.isCollapsed
            );
            const startPoint = event.touches[0];
            touchStartPointRef.current = startPoint
                ? { x: startPoint.pageX, y: startPoint.pageY }
                : null;
            longPressTimerRef.current = window.setTimeout(() => {
                longPressTimerRef.current = null;
            }, 500);
        };

        const handleTouchEnd = (event: TouchEvent) => {
            // FIX: Ignore if we tapped a link
            const target = event.target as HTMLElement;
            if (
                target.closest("a") ||
                target.closest("[data-highlight-id]") ||
                target.closest(".highlight-menu") ||
                target.closest(".highlight-action-menu") ||
                target.closest(".highlights-icon") ||
                target.closest(".settings-icon")
            ) return;

            const selection = window.getSelection();
            const hasSelection = selectionActiveRef.current ||
                selectionAtPointerDownRef.current ||
                Boolean(
                    selection &&
                    selection.rangeCount > 0 &&
                    !selection.isCollapsed
                );
            if (Date.now() < selectionBlockUntilRef.current) {
                selectionAtPointerDownRef.current = false;
                return;
            }
            const clearedRecently =
                !hasSelection &&
                selectionClearedAtRef.current > 0 &&
                Date.now() - selectionClearedAtRef.current < 500;
            selectionAtPointerDownRef.current = false;

            if (longPressTimerRef.current && !hasSelection && !clearedRecently) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
                const touchPoint = event.changedTouches[0] || event.touches[0];
                if (!touchPoint) return;
                const startPoint = touchStartPointRef.current;
                touchStartPointRef.current = null;
                if (startPoint) {
                    const dx = touchPoint.pageX - startPoint.x;
                    const dy = touchPoint.pageY - startPoint.y;
                    if (Math.hypot(dx, dy) > 10) return;
                }
                const { pageX, pageY } = touchPoint;
                const didNavigate = handlePageClick(pageX, pageY);
                if (didNavigate) event.preventDefault();
            }
        };

        window.addEventListener("touchstart", handleTouchStart);
        window.addEventListener("touchend", handleTouchEnd, { passive: false });

        return () => {
            window.removeEventListener("touchstart", handleTouchStart);
            window.removeEventListener("touchend", handleTouchEnd);
        };
    }, [pageWidth, handlePageClick]);

    // --- MOUSE EVENTS ---
    useEffect(() => {
        const container = containerElementRef.current;

        const handleMouseDown = () => {
            const selection = window.getSelection();
            selectionAtPointerDownRef.current = selectionActiveRef.current || Boolean(
                selection &&
                selection.rangeCount > 0 &&
                !selection.isCollapsed
            );
            longPressTimerRef.current = window.setTimeout(() => {}, 200);
        };

        const handleMouseUp = (event: MouseEvent) => {
            // FIX: Ignore if we clicked a link
            const target = event.target as HTMLElement;
            if (
                target.closest("a") ||
                target.closest("[data-highlight-id]") ||
                target.closest(".highlight-menu") ||
                target.closest(".highlight-action-menu") ||
                target.closest(".highlights-icon") ||
                target.closest(".settings-icon")
            ) return;

            const selection = window.getSelection();
            const hasSelection = selectionActiveRef.current ||
                selectionAtPointerDownRef.current ||
                Boolean(
                    selection &&
                    selection.rangeCount > 0 &&
                    !selection.isCollapsed
                );
            if (Date.now() < selectionBlockUntilRef.current) {
                selectionAtPointerDownRef.current = false;
                return;
            }
            const clearedRecently =
                !hasSelection &&
                selectionClearedAtRef.current > 0 &&
                Date.now() - selectionClearedAtRef.current < 500;
            selectionAtPointerDownRef.current = false;

            if (longPressTimerRef.current && !hasSelection && !clearedRecently) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
                handlePageClick(event.clientX, event.clientY);
            }
        };

        container?.addEventListener("mousedown", handleMouseDown);
        container?.addEventListener("mouseup", handleMouseUp);

        return () => {
            container?.removeEventListener("mousedown", handleMouseDown);
            container?.removeEventListener("mouseup", handleMouseUp);
        };
    }, [pageWidth, isOptionMenuVisible, handlePageClick, containerElementRef]);
};

export default useNavigation;
