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

    const handlePageClick = useCallback(
        (tapWidth: number, tapHeight: number) => {
            if (!isOptionMenuVisible && !showTutorial) {
                if (
                    tapWidth / pageWidth <= 0.4 &&
                    tapHeight / pageHeight < 0.8
                ) {
                    changePage(-1);
                }
                if (
                    tapWidth / pageWidth > 0.4 &&
                    tapHeight / pageHeight < 0.8
                ) {
                    changePage(1);
                }
            }
        },
        [changePage, isOptionMenuVisible, pageWidth, pageHeight, showTutorial],
    );

    useEffect(() => {
        const handleSelection = () => {
            const newSelectedText = window.getSelection()?.toString();
            if (newSelectedText && newSelectedText.length > 0) {
                selectedText.current = newSelectedText;
            } else selectedText.current = "";
        };
        document.addEventListener("selectionchange", handleSelection);
        return () => {
            document.removeEventListener("selectionchange", handleSelection);
        };
    }, []);

    // --- TOUCH EVENTS ---
    useEffect(() => {
        const handleTouchStart = () => {
            longPressTimerRef.current = window.setTimeout(() => {
                longPressTimerRef.current = null;
            }, 500);
        };

        const handleTouchEnd = (event: TouchEvent) => {
            // FIX: Ignore if we tapped a link
            const target = event.target as HTMLElement;
            if (target.closest("a")) return;

            if (longPressTimerRef.current && selectedText.current === "") {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
                const { pageX, pageY } = event.touches[0]; // Note: changedPageX might be needed if touches is empty on end
                // const touch = event.changedTouches[0];
                handlePageClick(pageX, pageY);
            }
        };

        window.addEventListener("touchstart", handleTouchStart);
        window.addEventListener("touchend", handleTouchEnd);

        return () => {
            window.removeEventListener("touchstart", handleTouchStart);
            window.removeEventListener("touchend", handleTouchEnd);
        };
    }, [pageWidth, handlePageClick]);

    // --- MOUSE EVENTS ---
    useEffect(() => {
        const container = containerElementRef.current;

        const handleMouseDown = () => {
            longPressTimerRef.current = window.setTimeout(() => {}, 200);
        };

        const handleMouseUp = (event: MouseEvent) => {
            // FIX: Ignore if we clicked a link
            const target = event.target as HTMLElement;
            if (target.closest("a")) return;

            if (longPressTimerRef.current && !selectedText.current) {
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
