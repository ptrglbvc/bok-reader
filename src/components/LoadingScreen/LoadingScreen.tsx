import { CSSProperties } from "react";
import styles from "./LoadingScreen.module.css";

// Allow CSS variables in style prop
interface CustomCSS extends CSSProperties {
    "--loader-color"?: string;
}

type LoadingScreenProps = {
    isLoading: boolean;
    color: string | undefined;
};

export default function LoadingScreen({
    isLoading,
    color,
}: LoadingScreenProps) {
    const spinnerStyle: CustomCSS = {
        "--loader-color": color || "red",
    };

    return (
        <div
            className={
                isLoading
                    ? styles["loading-screen"]
                    : styles["loading-screen-gon"]
            }
        >
            <div className={styles.spinner} style={spinnerStyle}>
                {/* The glowing center dot */}
                <div className={styles.core}></div>
            </div>
        </div>
    );
}
