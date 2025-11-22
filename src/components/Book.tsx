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
import useLocalStorage from "../hooks/useLocalStorage";
import useNavigation from "../hooks/useNavigation";
import PageNumber from "./PageNumber";

interface PageProps {
    content: string;
    title: string;
    setIsLoading: Dispatch<SetStateAction<boolean>>;
    fontSize: number;
    fontFamily: string;
    sidePadding: number;
    setFontSize: React.Dispatch<React.SetStateAction<number>>;
    showTutorial: boolean;
    setPadding: React.Dispatch<React.SetStateAction<number>>;
    setFontFamily: React.Dispatch<React.SetStateAction<string>>;
    isOptionMenuVisible: boolean;
    containerElementRef: React.RefObject<HTMLDivElement | null>;
}

export default function Book({
    content,
    title,
    setIsLoading,
    fontSize,
    sidePadding,
    fontFamily,
    isOptionMenuVisible,
    setFontSize,
    setPadding,
    setFontFamily,
    containerElementRef,
    showTutorial,
}: PageProps) {
    const bookRef = useRef<HTMLDivElement>(null);

    const [pageWidth, pageHeight, noOfPages] = usePage(containerElementRef);
    const [percentRead, setPercentRead] = usePercentageRead(bookRef);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageCount, setPageCount] = useState(0);

    useLocalStorage(title, percentRead, sidePadding, fontSize, fontFamily);

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

                    scrollContainer.scroll({
                        left: newValue * pageWidth * noOfPages,
                        behavior: "smooth",
                    });
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

    // Initial Load / Local Storage Restoration
    useEffect(() => {
        if (!title) return;
        const local = localStorage.getItem(title);
        if (local) {
            try {
                const parsedLocal = JSON.parse(local);
                if (parsedLocal) {
                    // Ensure we set percentRead before the layout effect runs
                    if (parsedLocal.percentRead !== undefined) {
                        setPercentRead(parsedLocal.percentRead);
                    }
                    if (parsedLocal.fontSize !== undefined)
                        setFontSize(parsedLocal.fontSize);
                    if (parsedLocal.padding !== undefined)
                        setPadding(parsedLocal.padding);
                    if (parsedLocal.fontFamily !== undefined)
                        setFontFamily(parsedLocal.fontFamily);
                }
            } catch (e) {
                console.error("Failed to parse local storage for", title, e);
                setPercentRead(0);
            }
        } else {
            setPercentRead(0);
        }
        // We don't blindly set currentPage to 1 here anymore;
        // we let the layout effect handle the initial page determination
    }, [title, setFontSize, setPadding, setFontFamily, setPercentRead]);

    // Layout & Scroll Restoration Effect
    useEffect(() => {
        const currentBookRef = bookRef.current;
        if (!currentBookRef || pageWidth <= 0 || pageHeight <= 0) return;

        setIsLoading(true);

        const timer = setTimeout(() => {
            // 1. Apply CSS Variables that affect layout
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

            // 2. FORCE REFLOW (Crucial for Safari)
            // Reading offsetHeight forces the browser to apply the styles above immediately
            // so that subsequent scroll calculations are based on the *new* layout.
            void currentBookRef.offsetHeight;

            // 3. Defer Scroll to next Animation Frame
            // Even with force reflow, Safari sometimes ignores scrollLeft changes
            // if done in the same tick as layout changes for multi-column elements.
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
                    // Recalculate target based on the *restored* percentRead
                    let targetPage = Math.round(noOfWholePages * percentRead);
                    targetPage = Math.max(
                        0,
                        Math.min(noOfWholePages - 1, targetPage),
                    );

                    // Always update scroll position to match the percentage,
                    // even if the page number hasn't technically changed in state.
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
        // We add percentRead here to ensure it re-runs if storage restores
        // a percentage after initial mount
        percentRead,
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
