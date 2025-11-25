import React, {
    useState,
    useRef,
    useEffect,
    Dispatch,
    SetStateAction,
    useCallback,
} from "react";
import usePage from "../hooks/usePage";
import usePercentageRead from "../hooks/usePercentageRead";
import usePersistentState from "../hooks/usePersistentState";
import useNavigation from "../hooks/useNavigation";
import PageNumber from "./PageNumber";

interface PageProps {
    content: string;
    title: string;
    setIsLoading: Dispatch<SetStateAction<boolean>>;
    fontSize: number;
    fontFamily: string;
    sidePadding: number;
    showTutorial: boolean;
    isOptionMenuVisible: boolean;
    containerElementRef: React.RefObject<HTMLDivElement | null>;
}

// Bouncy easing function
// x represents progress (0 to 1)
const easeOutBack = (x: number): number => {
    const c1 = 1.2; // Bounce amount. Higher = bouncier.
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export default function Book({
    content,
    title,
    setIsLoading,
    fontSize,
    sidePadding,
    fontFamily,
    isOptionMenuVisible,
    containerElementRef,
    showTutorial,
}: PageProps) {
    const bookRef = useRef<HTMLDivElement>(null);

    const [pageWidth, pageHeight, noOfPages] = usePage(containerElementRef);
    const [percentRead, setPercentRead] = usePercentageRead(bookRef);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageCount, setPageCount] = useState(0);

    // Persistent state for reading progress per book
    const [savedProgress, setSavedProgress] = usePersistentState<number>(
        `bok_progress_${title}`,
        0
    );

    const percentReadRef = useRef(percentRead);
    const animationRef = useRef<number | null>(null);

    // Sync percentRead to ref for use in timeouts/intervals
    useEffect(() => {
        percentReadRef.current = percentRead;
    }, [percentRead]);

    // Save progress when reading
    useEffect(() => {
        if (percentRead > 0) {
            setSavedProgress(percentRead);
        }
    }, [percentRead, setSavedProgress]);

    // Restore progress on load/title change
    useEffect(() => {
        if (savedProgress > 0) {
            setPercentRead(savedProgress);
        }
    }, [savedProgress, setPercentRead]);

    const changePage = useCallback(
        (amount: number) => {
            setCurrentPage((prev) => {
                const scrollContainer = bookRef.current;
                if (
                    scrollContainer &&
                    pageCount > 0 &&
                    noOfPages > 0 &&
                    scrollContainer.clientWidth > 0
                ) {
                    let newValue = prev + amount;
                    if (newValue < 0) newValue = 0;
                    if (newValue >= pageCount) {
                        newValue = pageCount - 1;
                    }

                    // --- CUSTOM ANIMATION LOGIC ---
                    if (animationRef.current) {
                        cancelAnimationFrame(animationRef.current);
                    }

                    const start = scrollContainer.scrollLeft;
                    const target = newValue * pageWidth * noOfPages;
                    const distance = target - start;

                    // Slightly longer duration to let the bounce breathe
                    const duration = 450; // ms
                    const startTime = performance.now();

                    const animateScroll = (currentTime: number) => {
                        const elapsed = currentTime - startTime;

                        if (elapsed < duration) {
                            // Use the bouncy easing here
                            const ease = easeOutBack(elapsed / duration);
                            scrollContainer.scrollLeft =
                                start + distance * ease;
                            animationRef.current =
                                requestAnimationFrame(animateScroll);
                        } else {
                            // Snap to final position
                            scrollContainer.scrollLeft = target;
                            animationRef.current = null;
                        }
                    };

                    animationRef.current = requestAnimationFrame(animateScroll);
                    // ------------------------------

                    return newValue;
                }
                return prev;
            });
        },
        [pageWidth, pageCount, noOfPages],
    );

    useNavigation(
        changePage,
        isOptionMenuVisible,
        containerElementRef,
        showTutorial,
    );

    // Layout & Scroll Restoration Effect
    useEffect(() => {
        const currentBookRef = bookRef.current;
        if (!currentBookRef || pageWidth <= 0 || pageHeight <= 0) return;

        setIsLoading(true);

        const timer = setTimeout(() => {
            currentBookRef.style.setProperty(
                "--side-padding",
                `${sidePadding}px`,
            );
            currentBookRef.style.setProperty("--font-size", `${fontSize}em`);
            currentBookRef.style.setProperty("--font-family", fontFamily);
            currentBookRef.style.setProperty(
                "--computed-width",
                `${pageWidth}px`,
            );
            currentBookRef.style.maxHeight = `${pageHeight}px`;

            // FORCE REFLOW
            void currentBookRef.offsetHeight;

            requestAnimationFrame(() => {
                if (!currentBookRef) return;

                const totalWidth = currentBookRef.scrollWidth;
                const newPageCount =
                    pageWidth > 0 && totalWidth > 0
                        ? Math.round(totalWidth / pageWidth)
                        : 0;

                const noOfWholePages =
                    noOfPages === 1
                        ? newPageCount
                        : Math.round(newPageCount / 2);
                setPageCount(noOfWholePages);

                if (noOfWholePages > 0 && currentBookRef.clientWidth > 0) {
                    const currentPercent = percentReadRef.current;

                    let targetPage = Math.round(
                        noOfWholePages * currentPercent,
                    );
                    targetPage = Math.max(
                        0,
                        Math.min(noOfWholePages - 1, targetPage),
                    );

                    setCurrentPage(targetPage);
                    currentBookRef.scrollLeft =
                        targetPage * pageWidth * noOfPages;
                } else {
                    setCurrentPage(1);
                }
                setIsLoading(false);
            });
        }, 400);

        return () => {
            clearTimeout(timer);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [
        pageWidth,
        pageHeight,
        sidePadding,
        fontSize,
        fontFamily,
        noOfPages,
        content,
        title,
        setIsLoading,
    ]);

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
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [changePage]);

    return (
        <>
            <div
                ref={bookRef}
                dangerouslySetInnerHTML={{ __html: content }}
                className="book-page"
            ></div>
            <PageNumber pages={pageCount} currentPage={currentPage} />
        </>
    );
}
