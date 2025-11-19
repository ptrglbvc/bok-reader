import React, { useState, CSSProperties } from "react";
import styles from "./TutorialOverlay.module.css";

interface TutorialOverlayProps {
    color?: string;
    onDismiss: () => void;
}

// Extending CSSProperties to allow custom variables in TypeScript
interface CustomCSS extends CSSProperties {
    "--accent-color"?: string;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
    color = "#4fc3f7",
    onDismiss,
}) => {
    const [isFading, setIsFading] = useState(false);

    const handleDismiss = () => {
        setIsFading(true);
        setTimeout(onDismiss, 400);
    };

    return (
        <div
            className={`${styles.overlay} ${isFading ? styles.fadeOut : ""}`}
            onClick={handleDismiss}
            style={{ "--accent-color": color } as CustomCSS}
        >
            {/* Left Zone */}
            <div className={styles.interactionZone}>
                <div className={styles.iconWrapper}>
                    <svg viewBox="0 0 24 24">
                        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    </svg>
                </div>
                <div className={styles.label}>Previous</div>
            </div>

            {/* Right Zone */}
            <div className={styles.interactionZone}>
                <div className={styles.iconWrapper}>
                    <svg viewBox="0 0 24 24">
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                    </svg>
                </div>
                <div className={styles.label}>Next</div>
            </div>

            {/* Center/Bottom Zone */}
            <div className={styles.centerZone}>
                <div className={styles.bottomIconGroup}>
                    <div className={styles.bottomIconWrapper}>
                        <svg viewBox="0 0 24 24">
                            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                        </svg>
                    </div>
                    <div
                        className={styles.label}
                        style={{ fontSize: "0.9rem" }}
                    >
                        Options
                    </div>
                    <div className={styles.bounceArrow}>
                        <svg width="24" height="24" viewBox="0 0 24 24">
                            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                        </svg>
                    </div>
                </div>

                <button
                    className={styles.dismissButton}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss();
                    }}
                >
                    Start Reading
                </button>
            </div>
        </div>
    );
};

export default TutorialOverlay;
