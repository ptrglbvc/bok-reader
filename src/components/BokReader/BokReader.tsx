import React, { useState, useEffect, useMemo, useRef } from "react";
import styled, { createGlobalStyle } from "styled-components";
import useEpub from "../../hooks/useEpub";
import Book from "../Book";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import OptionsMenu from "../OptionsMenu/OptionsMenu";
import TutorialOverlay from "../TutorialOverlay/TutorialOverlay";

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
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
        font-size: var(--font-size);

        column-gap: calc(2 * var(--side-padding));
        -webkit-column-fill: auto;
        -webkit-column-gap: calc(2 * var(--side-padding));

        overflow-x: auto;
        overscroll-behavior-x: none;

        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        box-sizing: border-box;

        scrollbar-width: none;
        -ms-overflow-style: none;
         &::-webkit-scrollbar {
            display: none;
         }

         > * {
              break-inside: avoid-column;
              page-break-inside: avoid;
              -webkit-column-break-inside: avoid;
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
            column-count: 1;
            -moz-column-count: 1;
            -webkit-column-count: 1;

            column-width: var(--computed-width, 100%);
            -webkit-column-width: var(--computed-width, 100%);

            width: 100%;
            box-sizing: border-box;

            img, svg {
                max-width: calc(100% - 2 * var(--side-padding)) !important;
                margin-bottom: 10px;
            }
        }
    }

    .book-page img,
    .book-page svg {
        border-radius: 10px;
        max-height: calc(100% - var(--top-padding) - var(--bottom-padding)) !important;
        display: block;
        margin-left: auto;
        margin-right: auto;
        object-fit: contain;
        box-sizing: border-box;
        break-inside: avoid-column;
        page-break-inside: avoid;
        -webkit-column-break-inside: avoid;
    }

    .book-page svg > image {
        width: 100%;
        height: 100%;
    }

    .bok-chapter {
      margin-bottom: 100%;
       break-inside: avoid-column;
       page-break-inside: avoid;
       -webkit-column-break-inside: avoid;
    }

    parsererror { display: none; }

    .page-number {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.4);
        z-index: 10;
        pointer-events: none;
        font-variant-numeric: tabular-nums;
        background: rgba(0, 0, 0, 0.3);
        padding: 4px 10px;
        border-radius: 12px;
        backdrop-filter: blur(2px);
    }

    .bottom-click-area {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 15%;
        z-index: 1000;
        background-color: transparent;
        cursor: pointer;
    }
  }
`;

interface BokReaderProps {
    epubDataSource: File | ArrayBuffer | string | null;
    onTitleChange?: (title: string) => void;
    onLoadingChange?: (isLoading: boolean) => void;
    onError?: (errorMsg: string) => void;
    className?: string;
    style?: React.CSSProperties;
    supportedFonts?: { displayName: string; name: string }[];
    color?: string;
}

const BokReaderWrapper = styled.div`
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    overflow-y: hidden;
`;

function usePersistentFlag(
    key: string,
    defaultValue: boolean,
): [boolean, (v: boolean) => void] {
    const [value, setValue] = useState(() => {
        if (typeof window === "undefined") return defaultValue;

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
            "--color-tint": color,
            "--side-padding": `${sidePadding}px`,
            "--top-padding": "30px",
            "--bottom-padding": "70px",
            "--font-size": `${fontSize}em`,
            "--font-family": fontFamily,
        }),
        [sidePadding, fontSize, fontFamily, color],
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

            {rawContent && (
                <>
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
