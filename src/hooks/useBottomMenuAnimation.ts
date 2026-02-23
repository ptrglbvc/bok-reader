import { useCallback, useEffect, useRef, useState } from "react";

export default function useBottomMenuAnimation(
    onClose: () => void,
    closeDurationMs = 350,
) {
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const closeTimerRef = useRef<number | null>(null);

    useEffect(() => {
        let firstRaf = 0;
        let secondRaf = 0;

        firstRaf = requestAnimationFrame(() => {
            secondRaf = requestAnimationFrame(() => {
                setIsVisible(true);
            });
        });

        return () => {
            cancelAnimationFrame(firstRaf);
            cancelAnimationFrame(secondRaf);
            if (closeTimerRef.current !== null) {
                window.clearTimeout(closeTimerRef.current);
            }
        };
    }, []);

    const closeMenu = useCallback(() => {
        requestAnimationFrame(() => {
            setIsVisible(false);
            setIsClosing(true);
        });

        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
        }

        closeTimerRef.current = window.setTimeout(() => {
            onClose();
        }, closeDurationMs);
    }, [closeDurationMs, onClose]);

    return {
        isVisible,
        isClosing,
        closeMenu,
    };
}
