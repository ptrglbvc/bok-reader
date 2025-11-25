import React, { useState, useEffect, useMemo, useRef } from "react";
import useEpub from "../../hooks/useEpub";
import usePersistentState from "../../hooks/usePersistentState"
import Book from "../Book";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import OptionsMenu from "../OptionsMenu/OptionsMenu";
import TutorialOverlay from "../TutorialOverlay/TutorialOverlay";
import "./BokReader.css"

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

    const [sidePadding, setSidePadding] = usePersistentState<number>("bok_global_side_padding", 30);
    const [fontSize, setFontSize] = usePersistentState<number>("bok_global_fontsize", 1.2);
    const [fontFamily, setFontFamily] = usePersistentState<string>("bok_global_font_family", "Inter");
    const [colorScheme, setColorScheme] = usePersistentState<string>("bok_global_theme", "Amoled Dark");

    const bokReaderWrapperRef = useRef<HTMLDivElement>(null);

    const [tutorialShown, setTutorialShown] = usePersistentState<boolean>("bok_tutorial_shown", false);
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
            className={`bok-reader-container ${colorScheme === 'davinci' ? 'davinci' : ''}`}
            style={{ ...style, ...dynamicCssVariables } as React.CSSProperties}
            ref={bokReaderWrapperRef}
        >
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
                            colorScheme={colorScheme}
                            setPadding={setSidePadding}
                            setFontSize={setFontSize}
                            setFontFamily={setFontFamily}
                            setColorScheme={setColorScheme}
                            supportedFonts={supportedFonts}
                            supportedColorschemes={[]}
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
        </div>
    );
};

export default BokReader;
export { BokReader };
