import React, { useState, useEffect, useCallback, useRef } from "react";
import styles from "./HighlightsMenu.module.css";
import { Highlight, HighlightColor } from "../Book";
import { calculatePageOfElement } from "../../helpful_functions/calculatePageOfElement";
import useBottomMenuAnimation from "../../hooks/useBottomMenuAnimation";
import Toast from "../Toast/Toast";

interface HighlightsMenuProps {
    highlights: Highlight[];
    onClose: () => void;
    onGoToPage: (page: number) => void;
    onRemoveHighlight: (id: string) => void;
    onUpdateHighlightColor: (id: string, color: HighlightColor) => void;
}

const HIGHLIGHT_COLORS: HighlightColor[] = ["yellow", "red", "blue", "purple"];

const HighlightsMenu: React.FC<HighlightsMenuProps> = ({
    highlights,
    onClose,
    onGoToPage,
    onRemoveHighlight,
    onUpdateHighlightColor
}) => {
    const { isVisible, isClosing, closeMenu } = useBottomMenuAnimation(onClose);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [pageMap, setPageMap] = useState<{ [id: string]: number }>({});
    const [isCopyToastVisible, setIsCopyToastVisible] = useState(false);
    const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const newPageMap: { [id: string]: number } = {};
        const timer = setTimeout(() => {
            highlights.forEach((highlight) => {
                try {
                    const span = document.querySelector(`span[data-highlight-id="${highlight.id}"]`);
                    const element = span || document.getElementById(highlight.chapterId);
                    if (element instanceof HTMLElement) {
                        newPageMap[highlight.id] = calculatePageOfElement(element) + 1;
                    }
                } catch {
                    // ignore
                }
            });
            setPageMap(newPageMap);
        }, 100);
        return () => clearTimeout(timer);
    }, [highlights]);

    useEffect(() => {
        return () => {
            if (copyToastTimerRef.current) {
                clearTimeout(copyToastTimerRef.current);
            }
        };
    }, []);

    const handleGoToHighlight = useCallback((highlight: Highlight) => {
        try {
            const span = document.querySelector(`span[data-highlight-id="${highlight.id}"]`);
            const element = span || document.getElementById(highlight.chapterId);
            if (element instanceof HTMLElement) {
                const page = calculatePageOfElement(element);
                onGoToPage(page);
            }
        } catch {
            // ignore
        }
        closeMenu();
    }, [closeMenu, onGoToPage]);

    const handleToggleActions = (event: React.MouseEvent, id: string) => {
        event.stopPropagation();
        setExpandedId((prev) => (prev === id ? null : id));
    };

    const getHighlightText = (highlight: Highlight) => {
        if (highlight.text) return highlight.text;
        const span = document.querySelector(`span[data-highlight-id="${highlight.id}"]`);
        if (span && span.textContent) return span.textContent;
        return "Highlighted text";
    };

    const copyTextToClipboard = async (text: string) => {
        if (!text) return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return;
            }
        } catch {
            // fallback below
        }

        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand("copy");
        } catch (err) {
            console.warn("Copy failed:", err);
        } finally {
            document.body.removeChild(textarea);
        }
    };

    const triggerCopyToast = useCallback(() => {
        setIsCopyToastVisible(false);
        requestAnimationFrame(() => setIsCopyToastVisible(true));

        if (copyToastTimerRef.current) {
            clearTimeout(copyToastTimerRef.current);
        }
        copyToastTimerRef.current = setTimeout(() => {
            setIsCopyToastVisible(false);
        }, 1600);
    }, []);

    const renderHighlights = () => {
        return (
            <ul className={styles["highlight-list"]}>
                {highlights.map((highlight) => {
                    const pageNum = pageMap[highlight.id];
                    const text = getHighlightText(highlight);
                    const excerpt = text.length > 140 ? `${text.slice(0, 140)}…` : text;

                    return (
                        <li key={highlight.id} className={styles["highlight-item"]}>
                            <div
                                className={styles["highlight-row"]}
                                onClick={() => handleGoToHighlight(highlight)}
                            >
                                <span className={styles["highlight-label"]}>{excerpt}</span>
                                <div className={styles["highlight-meta"]}>
                                    <span
                                        className={`${styles["highlight-color"]} ${styles[`highlight-color--${highlight.color}`]}`}
                                        aria-hidden="true"
                                    />
                                    {pageNum !== undefined && (
                                        <span className={styles["highlight-page-num"]}>{pageNum}</span>
                                    )}
                                    <button
                                        type="button"
                                        className={styles["actions-toggle"]}
                                        onClick={(event) => handleToggleActions(event, highlight.id)}
                                        aria-label="Highlight actions"
                                    >
                                        ⋯
                                    </button>
                                </div>
                            </div>
                            {expandedId === highlight.id && (
                                <div
                                    className={styles["highlight-actions"]}
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <div className={styles["highlight-swatch-row"]}>
                                        {HIGHLIGHT_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                className={`highlight-swatch highlight-swatch--${color}${highlight.color === color ? " highlight-swatch--active" : ""}`}
                                                onClick={() => {
                                                    onUpdateHighlightColor(highlight.id, color);
                                                }}
                                                aria-label={`Change highlight to ${color}`}
                                            />
                                        ))}
                                    </div>
                                    <div className={styles["highlight-action-row"]}>
                                        <button
                                            type="button"
                                            className="highlight-action-button"
                                            onClick={async () => {
                                                await copyTextToClipboard(text);
                                                triggerCopyToast();
                                            }}
                                        >
                                            Copy
                                        </button>
                                        <button
                                            type="button"
                                            className="highlight-action-button highlight-action-button--danger"
                                            onClick={() => onRemoveHighlight(highlight.id)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <div
            className={`${styles["highlights-overlay"]} ${isClosing ? styles["fade-out"] : ""}`}
            onClick={closeMenu}
        >
            <div
                className={`
                    ${styles["highlights-menu"]}
                    ${isVisible ? styles["visible"] : ""}
                    ${isClosing ? styles["slide-down"] : ""}
                `}
                onClick={(event) => event.stopPropagation()}
            >
                <div className={styles["highlights-header"]}>
                    <h2>Highlights</h2>
                    <button
                        onClick={closeMenu}
                        className={styles["close-button"]}
                        aria-label="Close menu"
                    >
                        ✕
                    </button>
                </div>

                <div className={styles["highlights-container"]}>
                    {highlights.length > 0 ? renderHighlights() : (
                        <div className={styles["empty-state"]}>
                            No highlights yet
                        </div>
                    )}
                </div>
            </div>
            <Toast message="Copied to clipboard" visible={isCopyToastVisible} />
        </div>
    );
};

export default HighlightsMenu;
