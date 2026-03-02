import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./HighlightNoteModal.module.css";
import Toast from "../Toast/Toast";

interface HighlightNoteModalProps {
    isOpen: boolean;
    initialNote?: string;
    highlightText?: string;
    onClose: () => void;
    onSave: (note: string) => void;
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
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setDraftNote(initialNote ?? "");
    }, [initialNote, isOpen]);

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
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        return () => {
            if (copyToastTimerRef.current) {
                clearTimeout(copyToastTimerRef.current);
            }
        };
    }, []);

    const handleSave = useCallback(() => {
        onSave(draftNote);
    }, [draftNote, onSave]);

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
        if (!draftNote) return;
        await copyTextToClipboard(draftNote);
        triggerCopyToast();
    }, [copyTextToClipboard, draftNote, triggerCopyToast]);

    if (!isOpen) return null;

    const excerpt = highlightText?.trim() ?? "";

    return (
        <div
            className={`highlight-note-modal-overlay ${styles["highlight-note-modal-overlay"]}`}
            onClick={onClose}
            onMouseDown={(event) => event.stopPropagation()}
            onMouseUp={(event) => event.stopPropagation()}
            onTouchEnd={(event) => event.stopPropagation()}
        >
            <div
                className={`highlight-note-modal ${styles["highlight-note-modal"]}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="highlight-note-title"
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
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={styles["highlight-note-button"]}
                        onClick={handleCopyNote}
                        disabled={!draftNote}
                        aria-label="Copy note text"
                    >
                        Copy
                    </button>
                    <button
                        type="button"
                        className={`${styles["highlight-note-button"]} ${styles["highlight-note-button--primary"]}`}
                        onClick={handleSave}
                    >
                        Save
                    </button>
                </div>
            </div>
            <Toast message="Note copied to clipboard" visible={isCopyToastVisible} />
        </div>
    );
};

export default HighlightNoteModal;
