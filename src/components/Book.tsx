import React, {
    useState,
    useRef,
    useEffect,
    Dispatch,
    SetStateAction,
    useCallback,
    useImperativeHandle,
    forwardRef
} from "react";
import usePage from "../hooks/usePage";
import usePercentageRead from "../hooks/usePercentageRead";
import usePersistentState from "../hooks/usePersistentState";
import useNavigation from "../hooks/useNavigation";
import PageNumber from "./PageNumber";
import { calculatePageOfElement } from "../helpful_functions/calculatePageOfElement";

// 1. Define Handle
export interface BookHandle {
    goToPage: (page: number) => void;
    findAndJumpToHref: (href: string) => void;
}

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
    // 2. Add callbacks
    onPageChange?: (page: number) => void;
    onPageCountChange?: (count: number) => void;
}

const easeOutBack = (x: number): number => {
    const c1 = 1.1; 
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

// 3. Use forwardRef
const Book = forwardRef<BookHandle, PageProps>(({
    content,
    title,
    setIsLoading,
    fontSize,
    sidePadding,
    fontFamily,
    isOptionMenuVisible,
    containerElementRef,
    showTutorial,
    onPageChange,
    onPageCountChange
}, ref) => {
    const bookRef = useRef<HTMLDivElement>(null);

    const [pageWidth, pageHeight, noOfPages] = usePage(containerElementRef);
    const [percentRead, setPercentRead] = usePercentageRead(bookRef);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageCount, setPageCount] = useState(0);

    const [savedProgress, setSavedProgress] = usePersistentState<number>(
        `bok_progress_${title}`,
        0
    );

    const percentReadRef = useRef(percentRead);
    const animationRef = useRef<number | null>(null);

    // Sync Page Count up
    useEffect(() => {
        if(onPageCountChange) onPageCountChange(pageCount);
    }, [pageCount, onPageCountChange]);

    // Sync Current Page up
    useEffect(() => {
        if(onPageChange) onPageChange(currentPage);
    }, [currentPage, onPageChange]);

    useEffect(() => {
        percentReadRef.current = percentRead;
    }, [percentRead]);

    useEffect(() => {
        if (percentRead > 0) setSavedProgress(percentRead);
    }, [percentRead, setSavedProgress]);

    useEffect(() => {
        if (savedProgress > 0) setPercentRead(savedProgress);
    }, [savedProgress, setPercentRead]);


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
    }));

    useNavigation(
        changePage,
        isOptionMenuVisible,
        containerElementRef,
        showTutorial,
    );

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

    return (
        <>
            <div
                ref={bookRef}
                dangerouslySetInnerHTML={{ __html: content }}
                className="book-page"
                id="bok-main-element"
            ></div>
            <PageNumber pages={pageCount} currentPage={currentPage} />
        </>
    );
});

export default Book;
