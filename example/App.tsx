import { useCallback } from "react";
import BokReader from "../src/components/BokReader/BokReader";
import "../src/style.css";

function App() {
    const epubUrl =
        "https://43ru4bvzl6.ufs.sh/f/7NUfZePLME3PYgjEwQBi3BkLgUlt1zNSyxXcsbWCT2RK0Iv8";

    const handleReaderTitleChange = useCallback((title: string) => {
        if (title && title !== "Loading...") {
            document.title = title;
        } else {
            document.title = "Bok";
        }
    }, []);

    const handleReaderError = useCallback((errorMsg: string) => {
        console.error("BokReader reported an error:", errorMsg);
        alert(`Error loading book: ${errorMsg}\nPlease try a different file.`);
    }, []);

    const handleReaderLoading = useCallback(() => { }, []);

    const supportedFonts = [
        { name: "Merriweather", displayName: "Merriweather" },
    ];
    const themes = {
        "Cyberpunk": {
            "--bg-color": "#050505",
            "--text-color": "#00ff9f",
            "--page-num-text": "#ff003c",
            "--page-num-bg": "rgba(0, 20, 10, 0.8)",
            "--page-num-border": "#00ff9f",
            "--color-tint": "#00ff9f"
        }
    }


    return (
        <>
            <div
                style={{
                    width: "100svw",
                    height: "100svh",
                    overflow: "hidden",
                }}
            >
                <BokReader
                    epubDataSource={epubUrl}
                    onTitleChange={handleReaderTitleChange}
                    onError={handleReaderError}
                    onLoadingChange={handleReaderLoading}
                    supportedFonts={supportedFonts}
                    themes={themes}
                />
            </div>
        </>
    );
}

export default App;
