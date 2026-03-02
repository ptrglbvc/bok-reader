import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./HighlightNoteModal.module.css";

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
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    const handleSave = useCallback(() => {
        onSave(draftNote);
    }, [draftNote, onSave]);

    if (!isOpen) return null;

    const excerpt = highlightText?.trim() ?? "";
    const excerptPreview = excerpt.length > 180 ? `${excerpt.slice(0, 180)}...` : excerpt;

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
                {excerptPreview && (
                    <p className={styles["highlight-note-excerpt"]}>{excerptPreview}</p>
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
                        className={`${styles["highlight-note-button"]} ${styles["highlight-note-button--primary"]}`}
                        onClick={handleSave}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HighlightNoteModal;
