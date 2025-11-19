// src/BokReader.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import styled, { createGlobalStyle } from "styled-components";
import useEpub from "../../hooks/useEpub"; // Import the modified hook
import Book from "../Book";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import OptionsMenu from "../OptionsMenu/OptionsMenu";
import TutorialOverlay from "../TutorialOverlay/TutorialOverlay";

// These styles apply *only* within BokReaderWrapper thanks to styled-components scoping
const ScopedGlobalStyle = createGlobalStyle`
  .bok-reader-container {
    font-family: system-ui, Avenir, Helvetica, Arial, sans-serif;
    line-height: 1.5;
    font-weight: 400;
    text-align: justify;
    color-scheme: dark light;
    color: rgb(215, 215, 215) !important;
    background-color: black;
    height: 100%;
    width: 100%;
    overflow: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
     &::-webkit-scrollbar { display: none; }
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    container-type: size;

    .book-page {
        margin: 0;
        font-family: var(--font-family);
        padding: var(--top-padding) var(--side-padding) var(--bottom-padding);
        height: 100%;
        text-shadow: 2px 2px 5px rgba(0, 0, 0);
        font-size: var(--font-size);

        column-gap: calc(2 * var(--side-padding));
        -webkit-column-fill: auto;
        // column-fill: auto; // MUST be auto for scrollWidth calculation to be correct
        -webkit-column-gap: calc(2 * var(--side-padding));

        // Enable horizontal scrolling of the columns
        overflow-x: hidden;
        overflow-y: hidden; // Prevent vertical scrollbar on the container itself
        // scroll-snap-type: x mandatory; // Snap pages (columns)
        // scroll-behavior: auto; // Let JS handle smooth scrolling during page turns
        -webkit-overflow-scrolling: touch;
        box-sizing: border-box;

        scrollbar-width: none;
        -ms-overflow-style: none;
         &::-webkit-scrollbar {
            display: none;
         }

        // Content *inside* the columns
         > * { // Target direct children (likely the .bok-chapter divs)
              break-inside: avoid-column; // Try to prevent elements breaking mid-column
              page-break-inside: avoid; /* Older alias */
              -webkit-column-break-inside: avoid;
         }
        p {
            color:
        }
    }

    @container (aspect-ratio > 1/1) {
        .book-page {
            column-count: 2;
            -moz-column-count: 2;
            -webkit-column-count: 2;
            column-width: calc(50% - var(--side-padding));
            -webkit-column-width: calc(50% - var(--side-padding));

            img, svg {
                max-width: calc(100% - 2 * var(--side-padding)) !important;
                margin-bottom: 10px;
            }
        }
    }

    @container (aspect-ratio <= 1/1) {
        .book-page {
            columns: var(--safari-is-stupid-width, 100%) auto;

            img, svg {
                max-width: calc(100% - 2 * var(--side-padding)) !important;
                margin-bottom: 10px;
            }
        }
    }    // --- Styles for Images/SVG within Columns ---

    .book-page img,
    .book-page svg {
        border-radius: 10px;
        // Max height respects the vertical padding of the book-page container
        max-height: calc(100% - var(--top-padding) - var(--bottom-padding)) !important;
        display: block;
        margin-left: auto; // Center if smaller than column width
        margin-right: auto;
        object-fit: contain; // Fit without distortion
        box-sizing: border-box; // Ensure border/padding included in size
         break-inside: avoid-column; // Crucial to prevent images splitting across columns
         page-break-inside: avoid;
         -webkit-column-break-inside: avoid;
    }

    .book-page svg > image {
        width: 100%; // Inherit size from parent SVG
        height: 100%;
    }

    // --- Chapter Styling ---
    .bok-chapter {
      margin-bottom: 100%;
       break-inside: avoid-column;
       page-break-inside: avoid;
       -webkit-column-break-inside: avoid;
    }

    // --- Other Scoped Styles ---
    parsererror { display: none; } // Hide EPUB parsing errors if they render

    .page-number {
        position: absolute;
        bottom: 15px; // Position relative to the reader container
        left: 50%;
        transform: translateX(-50%);
        font-size: 13px;
        color: gray;
        z-index: 10; // Above book content
        pointer-events: none; // Non-interactive
    }

    .bottom-click-area {
        position: absolute; // Within the reader container
        bottom: 0;
        left: 0;
        width: 100%;
        height: 15%;
        z-index: 1000; // Above page number, below options menu overlay
        background-color: transparent;
        cursor: pointer;
    }
  }
`;

interface BokReaderProps {
    epubDataSource: File | ArrayBuffer | string | null; // Allow string for URL
    onTitleChange?: (title: string) => void;
    onLoadingChange?: (isLoading: boolean) => void;
    onError?: (errorMsg: string) => void;
    className?: string;
    style?: React.CSSProperties;
    supportedFonts?: { displayName: string; name: string }[];
    color?: string;
}

// Wrapper div for scoping styles and establishing positioning context
const BokReaderWrapper = styled.div`
    width: 100%;
    height: 100%;
    position: relative;d
    overflow: hidden;d
    overflow-y: hidden;
`;

// Simple persistent flag hook for tutorial overlay
function usePersistentFlag(
    key: string,
    defaultValue: boolean,
): [boolean, (v: boolean) => void] {
    const [value, setValue] = useState(() => {
        const stored = localStorage.getItem(key);
        return stored === null ? defaultValue : stored === "true";
    });
    useEffect(() => {
        localStorage.setItem(key, value ? "true" : "false");
    }, [key, value]);
    return [value, setValue];
}

const BokReader: React.FC<BokReaderProps> = ({
    epubDataSource,
    onTitleChange,
    onLoadingChange,
    onError,
    className,
    style,
    color,
    supportedFonts = [],
}) => {
    const { title, rawContent, isLoading, error, loadEpub, setIsLoading } =
        useEpub();

    const [isOptionsMenuVisible, setIsOptionsMenuVisible] = useState(false);
    const [fontSize, setFontSize] = useState(1.2);
    const [sidePadding, setSidePadding] = useState(30);
    const [fontFamily, setFontFamily] = useState("Inter");

    const bokReaderWrapperRef = useRef<HTMLDivElement>(null);

    const [tutorialShown, setTutorialShown] = usePersistentFlag(
        "bokreader_tutorial_shown",
        false,
    );
    const [showTutorial, setShowTutorial] = useState(!tutorialShown);

    useEffect(() => {
        if (tutorialShown) setShowTutorial(false);
    }, [tutorialShown]);

    const dismissTutorial = () => {
        setShowTutorial(false);
        setTutorialShown(true);
    };

    useEffect(() => {
        if (epubDataSource) {
            loadEpub(epubDataSource);
        }
    }, [epubDataSource, loadEpub]); // Reload when source changes

    useEffect(() => {
        if (onTitleChange) {
            onTitleChange(title);
        }
    }, [title, onTitleChange]);

    // Report loading state changes upstream
    useEffect(() => {
        if (onLoadingChange) {
            onLoadingChange(isLoading);
        }
    }, [isLoading, onLoadingChange]);

    // Report errors upstream
    useEffect(() => {
        if (error && onError) {
            onError(error);
        }
    }, [error, onError]);

    const dynamicCssVariables = useMemo(
        () => ({
            "--color-tint": color,
            "--side-padding": `${sidePadding}px`,
            "--top-padding": "30px",
            "--bottom-padding": "70px",
            "--font-size": `${fontSize}em`,
            "--font-family": fontFamily,
        }),
        [sidePadding, fontSize, fontFamily],
    );

    if (error && !isLoading && !rawContent) {
        return (
            <BokReaderWrapper
                className={`bok-reader-container ${className || ""}`}
                style={style}
            >
                <ScopedGlobalStyle />
                <div style={{ padding: "20px", color: "red" }}>
                    Error loading EPUB: {error}
                </div>
            </BokReaderWrapper>
        );
    }

    return (
        <BokReaderWrapper
            className={`bok-reader-container ${className || ""}`}
            style={{ ...style, ...dynamicCssVariables } as React.CSSProperties}
            ref={bokReaderWrapperRef}
        >
            <ScopedGlobalStyle />
            <LoadingScreen isLoading={isLoading} color={color} />

            {/* Tutorial Overlay (only on first load) */}

            {/* Render Book only if content is ready and not loading */}
            {rawContent && (
                <>
                    {/* Only show tutorial overlay when not loading */}
                    {showTutorial && !isLoading && (
                        <TutorialOverlay
                            color={color}
                            onDismiss={dismissTutorial}
                        />
                    )}
                    <Book
                        content={rawContent}
                        title={title}
                        setIsLoading={setIsLoading}
                        fontSize={fontSize}
                        sidePadding={sidePadding}
                        fontFamily={fontFamily}
                        setPadding={setSidePadding}
                        setFontSize={setFontSize}
                        setFontFamily={setFontFamily}
                        isOptionMenuVisible={isOptionsMenuVisible}
                        containerElementRef={bokReaderWrapperRef}
                        showTutorial={showTutorial}
                    />

                    {isOptionsMenuVisible && (
                        <OptionsMenu
                            onClose={() => setIsOptionsMenuVisible(false)}
                            fontSize={fontSize}
                            padding={sidePadding}
                            fontFamily={fontFamily}
                            setPadding={setSidePadding}
                            setFontSize={setFontSize}
                            setFontFamily={setFontFamily}
                            supportedFonts={supportedFonts}
                        />
                    )}

                    {!isOptionsMenuVisible && (
                        <div
                            className="bottom-click-area"
                            onClick={() => {
                                if (!showTutorial)
                                    setIsOptionsMenuVisible(true);
                            }}
                            aria-label="Open reader options"
                        />
                    )}
                </>
            )}
            {!epubDataSource && !isLoading && !error && (
                <div style={{ padding: "20px", textAlign: "center" }}>
                    No EPUB loaded.
                </div>
            )}
        </BokReaderWrapper>
    );
};

export default BokReader;
export { BokReader };
