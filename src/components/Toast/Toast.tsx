import React from "react";
import styles from "./Toast.module.css";

export interface ToastProps {
    message: string;
    visible: boolean;
    role?: "status" | "alert";
    ariaLive?: "polite" | "assertive";
}

const Toast: React.FC<ToastProps> = ({ message, visible, role = "status", ariaLive = "polite" }) => {
    return (
        <div
            className={`${styles.toast} ${visible ? styles.visible : ""}`}
            role={role}
            aria-live={ariaLive}
        >
            {message}
        </div>
    );
};

export default Toast;
