import { useCallback } from "react";
import BokReader from "../src/components/BokReader/BokReader";
import "../src/style.css";

function App() {
    const epubUrl =
        "https://43ru4bvzl6.ufs.sh/f/7NUfZePLME3PdJkelD5KMeOsb4QVJfmEhZqaTPv9XkdHLUgu";

    const handleReaderTitleChange = useCallback((title: string) => {
        if (title && title !== "Loading...") {
            document.title = title; // Update the browser tab title
        } else {
            document.title = "Bok";
        }
    }, []);

    const handleReaderError = useCallback((errorMsg: string) => {
        console.error("BokReader reported an error:", errorMsg);
        alert(`Error loading book: ${errorMsg}\nPlease try a different file.`);
        console.error("Failed to load from URL, cannot automatically reset.");
    }, []);

    const handleReaderLoading = useCallback((_isLoading: boolean) => {}, []);

    const supportedFonts = [
        { name: "Inter", displayName: "Inter" },
        { name: "Roboto", displayName: "Roboto" },
        { name: "Merriweather", displayName: "Merriweather" },
    ];

    return (
        <>
            <div
                style={{
                    width: "100svw",
                    height: "100svh",
                    overflow: "hidden",
                    // @ts-expect-error sorry ts, we need this stupid thing for stupid safari
                    "--safari-is-stupid-width": "100vw",
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
