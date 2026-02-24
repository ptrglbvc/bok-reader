import { useEffect, useRef, useState } from "react";
import styles from "./CustomDropdown.module.css";

export interface DropdownOption {
    label: string;
    value: string;
}

interface CustomDropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
}

function CustomDropdown({ options, value, onChange, ariaLabel }: CustomDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (!wrapperRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    const selected = options.find((option) => option.value === value) ?? options[0];

    return (
        <div className={styles["custom-select"]} ref={wrapperRef}>
            <button
                type="button"
                className={styles["select-trigger"]}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={ariaLabel}
                onClick={() => setIsOpen((prev) => !prev)}
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        setIsOpen(false);
                    }
                }}
            >
                <span className={styles["select-trigger-label"]}>{selected?.label}</span>
                <span
                    className={`${styles["select-trigger-arrow"]} ${isOpen ? styles["select-trigger-arrow-open"] : ""}`}
                    aria-hidden="true"
                >
                    ▾
                </span>
            </button>

            {isOpen && (
                <div className={styles["select-menu"]} role="listbox" aria-label={ariaLabel}>
                    {options.map((option) => {
                        const isSelected = option.value === value;
                        return (
                            <button
                                type="button"
                                key={option.value}
                                role="option"
                                aria-selected={isSelected}
                                className={`${styles["select-option"]} ${isSelected ? styles["select-option-active"] : ""}`}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default CustomDropdown;
