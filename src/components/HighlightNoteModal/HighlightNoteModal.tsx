import React, { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import styles from "./HighlightNoteModal.module.css";
import Toast from "../Toast/Toast";

const KEYBOARD_OVERLAP_THRESHOLD_PX = 80;
const EXTRA_KEYBOARD_LIFT_PX = 25;

interface HighlightNoteModalProps {
    isOpen: boolean;
    initialNote?: string;
    highlightText?: string;
    onClose: () => void;
    onSave: (note: string) => void | Promise<void>;
}

const HighlightNoteModal: React.FC<HighlightNoteModalProps> = ({
    isOpen,
    initialNote,
    highlightText,
    onClose,
    onSave
}) => {
    const [draftNote, setDraftNote] = useState(initialNote ?? "");
    const [isCopyToastVisible, setIsCopyToastVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [keyboardInset, setKeyboardInset] = useState(0);
    const isSavingRef = useRef(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleRequestClose = useCallback(() => {
        if (isSaving || isSavingRef.current) return;
        onClose();
    }, [isSaving, onClose]);
    useEffect(() => {
        if (!isOpen) return;
        setDraftNote(initialNote ?? "");
    }, [initialNote, isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setIsSaving(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const frameId = requestAnimationFrame(() => {
            const textarea = textareaRef.current;
            if (!textarea) return;
            textarea.focus();
            const valueLength = textarea.value.length;
            textarea.setSelectionRange(valueLength, valueLength);
        });

        return () => cancelAnimationFrame(frameId);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                handleRequestClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleRequestClose, isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setKeyboardInset(0);
            return;
        }
        if (typeof window === "undefined" || !window.visualViewport) return;

        const viewport = window.visualViewport;

        const updateKeyboardInset = () => {
            const overlap = window.innerHeight - viewport.height - viewport.offsetTop;
            const nextInset = overlap > KEYBOARD_OVERLAP_THRESHOLD_PX
                ? Math.round(overlap) + EXTRA_KEYBOARD_LIFT_PX
                : 0;
            setKeyboardInset((current) => (Math.abs(current - nextInset) <= 1 ? current : nextInset));
        };

        updateKeyboardInset();
        viewport.addEventListener("resize", updateKeyboardInset);
        viewport.addEventListener("scroll", updateKeyboardInset);
        window.addEventListener("resize", updateKeyboardInset);

        return () => {
            viewport.removeEventListener("resize", updateKeyboardInset);
            viewport.removeEventListener("scroll", updateKeyboardInset);
            window.removeEventListener("resize", updateKeyboardInset);
        };
    }, [isOpen]);

    useEffect(() => {
        return () => {
            if (copyToastTimerRef.current) {
                clearTimeout(copyToastTimerRef.current);
            }
        };
    }, []);

    const handleSave = useCallback(async () => {
        if (isSavingRef.current) return;

        isSavingRef.current = true;
        flushSync(() => {
            setIsSaving(true);
        });
        textareaRef.current?.focus();

        try {
            await onSave(draftNote);
        } catch (error) {
            console.warn("Save failed:", error);
        } finally {
            isSavingRef.current = false;
            setIsSaving(false);
        }
    }, [draftNote, onSave]);

    const handleSavePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        textareaRef.current?.focus();
        void handleSave();
    }, [handleSave]);

    const copyTextToClipboard = useCallback(async (text: string) => {
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
    }, []);

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

    const handleCopyNote = useCallback(async () => {
        if (!draftNote || isSaving) return;
        await copyTextToClipboard(draftNote);
        triggerCopyToast();
    }, [copyTextToClipboard, draftNote, isSaving, triggerCopyToast]);

    if (!isOpen) return null;

    const excerpt = highlightText?.trim() ?? "";

    return (
        <div
            className={`highlight-note-modal-overlay ${styles["highlight-note-modal-overlay"]}`}
            onClick={handleRequestClose}
            onMouseDown={(event) => event.stopPropagation()}
            onMouseUp={(event) => event.stopPropagation()}
            onTouchEnd={(event) => event.stopPropagation()}
        >
            <div
                className={`highlight-note-modal ${styles["highlight-note-modal"]}`}
                role="dialog"
                aria-modal="true"
                aria-busy={isSaving}
                aria-labelledby="highlight-note-title"
                style={keyboardInset > 0 ? { marginBottom: `${keyboardInset}px` } : undefined}
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onMouseUp={(event) => event.stopPropagation()}
                onTouchEnd={(event) => event.stopPropagation()}
            >
                <h2 id="highlight-note-title">{initialNote?.trim() ? "Edit note" : "Add note"}</h2>
                {excerpt && (
                    <p className={styles["highlight-note-excerpt"]}>{excerpt}</p>
                )}
                <textarea
                    ref={textareaRef}
                    className={styles["highlight-note-textarea"]}
                    value={draftNote}
                    onChange={(event) => setDraftNote(event.target.value)}
                    placeholder="Write your note"
                    rows={6}
                />
                <div className={styles["highlight-note-actions"]}>
                    <button
                        type="button"
                        className={styles["highlight-note-button"]}
                        onClick={handleRequestClose}
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={styles["highlight-note-button"]}
                        onClick={handleCopyNote}
                        disabled={!draftNote || isSaving}
                        aria-label="Copy note text"
                    >
                        Copy
                    </button>
                    <button
                        type="button"
                        className={`${styles["highlight-note-button"]} ${styles["highlight-note-button--primary"]}${isSaving ? ` ${styles["highlight-note-button--saving"]}` : ""}`}
                        onPointerDown={handleSavePointerDown}
                        onClick={handleSave}
                        aria-disabled={isSaving}
                    >
                        <span className={styles["highlight-note-button-content"]}>
                            {isSaving && (
                                <span
                                    className={styles["highlight-note-button-spinner"]}
                                    aria-hidden="true"
                                />
                            )}
                            {isSaving ? "Saving..." : "Save"}
                        </span>
                    </button>
                </div>
            </div>
            <Toast message="Note copied to clipboard" visible={isCopyToastVisible} />
        </div>
    );
};

export default HighlightNoteModal;
