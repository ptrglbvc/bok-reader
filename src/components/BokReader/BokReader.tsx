import React, { useState, useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import useEpub from "../../hooks/useEpub";
import Book from "../Book";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import OptionsMenu from "../OptionsMenu/OptionsMenu";
import TutorialOverlay from "../TutorialOverlay/TutorialOverlay";

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
        // SSR Check
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
                {/* Removed ScopedGlobalStyle */}
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
            {/* Removed ScopedGlobalStyle */}
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
