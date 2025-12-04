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

    const handleReaderLoading = useCallback((_isLoading: boolean) => {}, []);

    const supportedFonts = [
        { name: "Roboto Condensed", displayName: "Roboto Condensed" },
        { name: "Merriweather", displayName: "Merriweather" },
    ];

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
                    color={"#c9f"}
                />
            </div>
        </>
    );
}

export default App;
