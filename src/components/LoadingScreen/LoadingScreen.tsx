import styles from "./LoadingScreen.module.css";

type LoadingScreenProps = {
    isLoading: boolean;
};

export default function LoadingScreen({
    isLoading,
}: LoadingScreenProps) {
    return (
        <div
            className={
                isLoading
                    ? styles["loading-screen"]
                    : styles["loading-screen-gon"]
            }
        >
            <div className={styles.spinner} >
                <div className={styles.core}></div>
            </div>
        </div>
    );
}
