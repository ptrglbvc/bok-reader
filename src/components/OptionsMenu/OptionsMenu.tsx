import { useRef, useCallback } from "react";
import toggleFullscreen from "../../helpful_functions/toggleFullscreen";
import useBottomMenuAnimation from "../../hooks/useBottomMenuAnimation";
import styles from "./OptionsMenu.module.css";
import { Theme } from "../BokReader/BokReader.tsx";
import CustomDropdown, { DropdownOption } from "../CustomDropdown/CustomDropdown";

interface OptionsMenuProps {
    onClose: () => void;
    fontSize: number;
    padding: number;
    fontFamily: string;
    theme: string;
    setFontSize: React.Dispatch<React.SetStateAction<number>>;
    setPadding: React.Dispatch<React.SetStateAction<number>>;
    setFontFamily: React.Dispatch<React.SetStateAction<string>>;
    setTheme: React.Dispatch<React.SetStateAction<string>>;
    supportedFonts: { displayName: string; name: string }[];
    allThemes: { [key: string]: Theme }
}

function OptionsMenu({
    onClose,
    fontSize,
    padding,
    fontFamily,
    theme,
    setFontSize,
    setPadding,
    setTheme,
    setFontFamily,
    supportedFonts = [],
    allThemes
}: OptionsMenuProps) {
    const { isVisible, isClosing, closeMenu } = useBottomMenuAnimation(onClose);

    const fontValueRef = useRef<HTMLSpanElement>(null);
    const paddingValueRef = useRef<HTMLSpanElement>(null);

    const allFonts = [
        { displayName: "Literata", name: "Literata" },
        { displayName: "Cormorant", name: "Cormorant Garamond" },
        { displayName: "Roboto", name: "Roboto Condensed" },
        ...supportedFonts,
        { displayName: "System Default", name: "system-ui" },
    ];

    const allThemesArray = Object.keys(allThemes)
    const fontOptions: DropdownOption[] = allFonts.map((font) => ({ label: font.displayName, value: font.name }));
    const themeOptions: DropdownOption[] = allThemesArray.map((themeName) => ({ label: themeName, value: themeName }));

    const handleOverlayClick = useCallback(() => {
        closeMenu();
    }, [closeMenu]);

    const handleMenuClick = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
    }, []);

    const handleContextMenu = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
    }, []);

    const animateValue = useCallback((ref: React.RefObject<HTMLSpanElement | null>) => {
        if (ref.current) {
            ref.current.classList.add(styles['value-changed']);
            setTimeout(() => {
                ref.current?.classList.remove(styles['value-changed']);
            }, 200);
        }
    }, []);

    const handlePaddingIncrement = useCallback(() => {
        if (padding <= 70) {
            setPadding((prev) => prev + 5);
            animateValue(paddingValueRef);
        }
    }, [padding, setPadding, animateValue]);

    const handlePaddingDecrement = useCallback(() => {
        if (padding - 5 > 0) {
            setPadding((prev) => prev - 5);
            animateValue(paddingValueRef);
        }
    }, [padding, setPadding, animateValue]);

    const handleFontIncrement = useCallback(() => {
        if (fontSize < 3) {
            setFontSize((prev) => prev + 0.2);
            animateValue(fontValueRef);
        }
    }, [fontSize, setFontSize, animateValue]);

    const handleFontDecrement = useCallback(() => {
        if (fontSize - 0.2 > 0.6) {
            setFontSize((prev) => prev - 0.2);
            animateValue(fontValueRef);
        }
    }, [fontSize, setFontSize, animateValue]);

    const getMenuClassName = () => {
        const classes = [styles['options-menu']];
        if (isVisible) classes.push(styles['visible']);
        if (isClosing) classes.push(styles['slide-down']);
        return classes.join(' ');
    };

    const getOverlayClassName = () => {
        const classes = [styles['options-menu-overlay']];
        if (isClosing) classes.push(styles['fade-out']);
        return classes.join(' ');
    };

    return (
        <div
            className={getOverlayClassName()}
            onClick={handleOverlayClick}
            onContextMenu={handleContextMenu}
        >
            <div
                className={getMenuClassName()}
                onClick={handleMenuClick}
                onContextMenu={handleContextMenu}
                style={{ userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
            >
                <button
                    onClick={closeMenu}
                    className={styles['close-button']}
                    aria-label="Close menu"
                >
                    ✕
                </button>

                <h2 className={styles['title']}>Reader Options</h2>

                <div className={styles['options-buttons']}>
                    {/* Font Family */}
                    <div className={styles['option-row']}>
                        <div className={styles['option-label']}>Font family</div>
                        <CustomDropdown
                            options={fontOptions}
                            value={fontFamily}
                            onChange={setFontFamily}
                            ariaLabel="Select font family"
                        />
                    </div>

                    {/* Color Scheme */}
                    <div className={styles['option-row']}>
                        <div className={styles['option-label']}>Color Scheme</div>
                        <CustomDropdown
                            options={themeOptions}
                            value={theme}
                            onChange={setTheme}
                            ariaLabel="Select color scheme"
                        />
                    </div>

                    {/* Side Padding */}
                    <div className={styles['option-row']}>
                        <div className={styles['option-label']}>Side padding</div>
                        <div className={styles['option-controls']}>
                            <button
                                className={styles['stepper-button']}
                                onClick={handlePaddingDecrement}
                            >
                                -
                            </button>
                            <span
                                ref={paddingValueRef}
                                className={styles['option-value']}
                            >
                                {padding}
                            </span>
                            <button
                                className={styles['stepper-button']}
                                onClick={handlePaddingIncrement}
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* Font Size */}
                    <div className={styles['option-row']}>
                        <div className={styles['option-label']}>Font size</div>
                        <div className={styles['option-controls']}>
                            <button
                                className={styles['stepper-button']}
                                onClick={handleFontDecrement}
                            >
                                -
                            </button>
                            <span
                                ref={fontValueRef}
                                className={styles['option-value']}
                            >
                                {Math.round(fontSize * 10)}
                            </span>
                            <button
                                className={styles['stepper-button']}
                                onClick={handleFontIncrement}
                            >
                                +
                            </button>
                        </div>
                    </div>
                    {/* iOS doesn't support this api and you will get a nasty client side exception if you dont do this*/}
                    {'requestFullscreen' in document.documentElement ?
                        <button
                            className={styles['fullscreen-button']}
                            onClick={toggleFullscreen}
                        >
                            Toggle fullscreen
                        </button>
                        : <></>}
                </div>
            </div>
        </div>
    );
}

export default OptionsMenu;
