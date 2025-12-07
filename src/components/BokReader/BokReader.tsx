import React, { useState, useEffect, useMemo, useRef } from "react";
import { Settings } from "lucide-react";
import useEpub from "../../hooks/useEpub";
import usePersistentState from "../../hooks/usePersistentState"
import Book, { BookHandle } from "../Book";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import OptionsMenu from "../OptionsMenu/OptionsMenu";
import NavigationMenu from "../NavigationMenu/NavigationMenu";
import TutorialOverlay from "../TutorialOverlay/TutorialOverlay";
import "./BokReader.css"

export interface Theme {
    "--bg-color": string,
    "--text-color": string,
    "--page-num-text": string,
    "--page-num-bg": string,
    "--page-num-border": string,
    "--color-tint": string
}

interface BokReaderProps {
    epubDataSource: File | ArrayBuffer | string | null;
    onTitleChange?: (title: string) => void;
    onLoadingChange?: (isLoading: boolean) => void;
    onError?: (errorMsg: string) => void;
    className?: string;
    style?: React.CSSProperties;
    supportedFonts?: { displayName: string; name: string }[];
    themes?: { [key: string]: Theme }

}

const BUILTIN_THEMES: { [key: string]: Theme } = {
    "Da Vinci": {
        "--bg-color": "#dccba3",
        "--text-color": "#463425",
        "--page-num-text": "#2b1f15",
        "--page-num-bg": "rgba(70, 52, 37, 0.1)",
        "--page-num-border": "rgba(70, 52, 37, 0.2)",
        "--color-tint": "#c9f"
    },
    "Amoled Dark": {
        "--bg-color": "black",
        "--text-color": "rgb(215, 215, 215)",
        "--page-num-text": "rgba(255, 255, 255, 0.4)",
        "--page-num-bg": "rgba(0, 0, 0, 0.3)",
        "--page-num-border": "rgba(255, 255, 255, 0.2)",
        "--color-tint": "#c9f"
    }
}

export const BokReader: React.FC<BokReaderProps> = ({
    epubDataSource,
    onTitleChange,
    onLoadingChange,
    onError,
    className,
    style,
    supportedFonts = [],
    themes = {},
}) => {
    const { title, rawContent, toc, isLoading, error, loadEpub, setIsLoading } =
        useEpub();

    const allThemes = useMemo(() => {
        return { ...BUILTIN_THEMES, ...themes };
    }, [themes]);

    const [activeMenu, setActiveMenu] = useState<'none' | 'options' | 'navigation'>('none');

    const [sidePadding, setSidePadding] = usePersistentState<number>("bok_global_side_padding", 20);
    const [fontSize, setFontSize] = usePersistentState<number>("bok_global_fontsize", 1.4);
    const [fontFamily, setFontFamily] = usePersistentState<string>("bok_global_font_family", "Literata");
    const [theme, setTheme] = usePersistentState<string>("bok_global_theme", "Amoled Dark");


    const bokReaderWrapperRef = useRef<HTMLDivElement>(null);
    const bookComponentRef = useRef<BookHandle>(null);

    const [currentBookPage, setCurrentBookPage] = useState(0);
    const [totalBookPages, setTotalBookPages] = useState(0);

    const [tutorialShown, setTutorialShown] = usePersistentState<boolean>("bok_tutorial_shown", false);
    const [showTutorial, setShowTutorial] = useState(!tutorialShown);

    useEffect(() => {
        if (!allThemes[theme]) setTheme("Amoled Dark")
    });

    useEffect(() => {
        if (tutorialShown) setShowTutorial(false);
    }, [tutorialShown]);

    // --------------------------------------------------------
    // Dynamic Theme Color for Notch Area/Status Bar
    // (relevant mostly for when the book is fullscreen
    // --------------------------------------------------------
    useEffect(() => {
        // We put this in a small timeout to ensure the CSS class has applied 
        // and the browser has computed the new variable values.
        const timer = setTimeout(() => {
            if (bokReaderWrapperRef.current) {
                const computedStyle = getComputedStyle(bokReaderWrapperRef.current);
                const bgColor = computedStyle.getPropertyValue('--bg-color').trim();

                // 2. Find or create the meta theme-color tag
                let metaThemeColor = document.querySelector("meta[name='theme-color']");
                if (!metaThemeColor) {
                    metaThemeColor = document.createElement("meta");
                    metaThemeColor.setAttribute("name", "theme-color");
                    document.head.appendChild(metaThemeColor);
                }

                // 3. Set the content to the matched color
                if (bgColor) {
                    metaThemeColor.setAttribute("content", bgColor);

                    // 4. Also set body background to match (helps with overscroll/notch gaps)
                    document.body.style.backgroundColor = bgColor;
                }
            }
        }, 50);

        return () => clearTimeout(timer);
    }, [theme]);

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
            "--side-padding": `${sidePadding}px`,
            "--top-padding": "30px",
            "--bottom-padding": "70px",
            "--font-size": `${fontSize}em`,
            "--font-family": fontFamily,
            ...allThemes[theme]
        }),
        [sidePadding, fontSize, fontFamily, theme, allThemes],
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
            className={"bok-reader-container"}
            style={{ ...style, ...dynamicCssVariables } as React.CSSProperties}
            ref={bokReaderWrapperRef}
        >
            <LoadingScreen isLoading={isLoading} />

            {rawContent && (
                <>
                    {showTutorial && !isLoading && (
                        <TutorialOverlay
                            onDismiss={dismissTutorial}
                        />
                    )}
                    <Book
                        ref={bookComponentRef}
                        content={rawContent}
                        title={title}
                        setIsLoading={setIsLoading}
                        fontSize={fontSize}
                        sidePadding={sidePadding}
                        fontFamily={fontFamily}
                        isOptionMenuVisible={activeMenu !== 'none'}
                        containerElementRef={bokReaderWrapperRef}
                        showTutorial={showTutorial}
                        onPageChange={setCurrentBookPage}
                        onPageCountChange={setTotalBookPages}
                    />

                    {activeMenu === 'options' && (
                        <OptionsMenu
                            onClose={() => setActiveMenu('none')}
                            fontSize={fontSize}
                            padding={sidePadding}
                            fontFamily={fontFamily}
                            theme={theme}
                            setPadding={setSidePadding}
                            setFontSize={setFontSize}
                            setFontFamily={setFontFamily}
                            setTheme={setTheme}
                            allThemes={allThemes}
                            supportedFonts={supportedFonts}
                        />
                    )}

                    {activeMenu === 'navigation' && !isLoading && (
                        <NavigationMenu
                            toc={toc}
                            currentPage={currentBookPage}
                            totalPages={totalBookPages}
                            onClose={() => setActiveMenu('none')}
                            onGoToPage={(page) => bookComponentRef.current?.goToPage(page)}
                            onChapterClick={(href) => bookComponentRef.current?.findAndJumpToHref(href)}
                        />
                    )}

                    {activeMenu === 'none' && !showTutorial && !isLoading && (
                        <div className="bottom-interaction-layer">
                            <div
                                className="trigger-zone"
                                onClick={() => { console.log("Left Click - Reserved") }}
                            />

                            <div
                                className="trigger-zone"
                                onClick={() => setActiveMenu('navigation')}
                                aria-label="Open Navigation"
                            />

                            <div
                                className="trigger-zone"
                                onClick={() => setActiveMenu('options')}
                                aria-label="Open Settings"
                            />

                            <div
                                className="settings-icon"
                                onClick={() => setActiveMenu('options')}
                                aria-label="Open Settings"
                            >
                                <Settings size={16} />
                            </div>
                        </div>
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
