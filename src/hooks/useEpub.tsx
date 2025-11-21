// src/hooks/useEpub.tsx
import JSZip from "jszip";
import { useState, useCallback, useRef } from "react";

type BlobImages = { [key: string]: string };

export default function useEpub() {
    const [rawContent, setRawContent] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [title, setTitle] = useState("");
    const [error, setError] = useState<string | null>(null);

    let currentObfFolder = "";
    let currentStyle = "";
    const currentZip = useRef<JSZip | null>(null);
    const styleLinkElement = useRef<HTMLLinkElement | null>(null);
    const currentImages: BlobImages = {};

    const validTypes = [
        "text/html",
        "text/xml",
        "application/xml",
        "application/xhtml+xml",
        "image/svg+xml",
    ];

    const loadEpub = useCallback(
        async (source: File | ArrayBuffer | string) => {
            setIsLoading(true);
            setRawContent("");
            setTitle("Loading...");
            setError(null);
            if (styleLinkElement.current) {
                document.head.removeChild(styleLinkElement.current);
                URL.revokeObjectURL(styleLinkElement.current.href);
                styleLinkElement.current = null;
            }

            try {
                let buffer: ArrayBuffer;
                if (typeof source === "string") {
                    // Fetch from URL
                    const response = await fetch(source);
                    if (!response.ok) {
                        throw new Error(
                            `HTTP error! status: ${response.status} ${response.statusText}`,
                        );
                    }
                    buffer = await response.arrayBuffer();
                } else if (source instanceof File) {
                    // Read from File object
                    buffer = await source.arrayBuffer();
                } else {
                    // Assume it's already an ArrayBuffer
                    buffer = source;
                }

                if (!buffer || buffer.byteLength === 0) {
                    throw new Error(
                        "EPUB source is empty or could not be read.",
                    );
                }

                currentZip.current = await JSZip.loadAsync(buffer);
                await readContainer();
            } catch (err: unknown) {
                const errorMessage =
                    err instanceof Error
                        ? err.message
                        : "An unknown error occurred while fetching or loading the EPUB.";
                console.error("Error processing EPUB source:", err);
                setError(errorMessage);
                setRawContent("");
                setTitle("");
                setIsLoading(false);
            }
        },
        // eslint-disable-next-line
        [],
    );

    async function readContainer() {
        if (!currentZip.current) throw new Error("Zip not loaded");

        const containerPath = "META-INF/container.xml";
        const containerFile = currentZip.current.file(containerPath);
        if (!containerFile)
            throw new Error("META-INF/container.xml not found.");

        const containerContent = await containerFile.async("text");
        const opfPath = getOpfPath(containerContent);
        if (!opfPath)
            throw new Error("OPF file path not found in container.xml.");

        currentObfFolder = opfPath.substring(0, opfPath.lastIndexOf("/") + 1);

        const opfFile = currentZip.current.file(opfPath);
        if (!opfFile) throw new Error(`OPF file not found at path: ${opfPath}`);

        const opfContent = await opfFile.async("text");
        const parser = new DOMParser();
        const parsedOpf = parser.parseFromString(opfContent, "application/xml");

        const parserError = parsedOpf.querySelector("parsererror");
        if (parserError) {
            throw new Error(
                `Error parsing OPF file: ${
                    parserError.textContent || "Unknown XML parse error"
                }`,
            );
        }

        getTitle(parsedOpf);
        await parseManifestAndSpine(parsedOpf);
    }

    function getOpfPath(containerContent: string): string | null {
        const parser = new DOMParser();
        const containerDOM = parser.parseFromString(
            containerContent,
            "application/xml",
        );
        const rootfile = containerDOM.querySelector(
            'rootfile[media-type="application/oebps-package+xml"]',
        );
        const fullPath = rootfile?.getAttribute("full-path");
        return fullPath ?? null;
    }

    function getTitle(opf: Document) {
        const titleElement =
            opf.querySelector("metadata > dc\\:title") ||
            opf.querySelector("metadata > title");
        setTitle(titleElement?.textContent || "Untitled Book");
    }

    async function parseManifestAndSpine(opf: Document) {
        if (!currentZip.current) return;

        const manifestItems: { [id: string]: { href: string; type: string } } =
            {};
        opf.querySelectorAll("manifest > item").forEach((item) => {
            const id = item.getAttribute("id");
            const href = item.getAttribute("href");
            const type = item.getAttribute("media-type");
            if (id && href && type) {
                manifestItems[id] = { href: decodeURIComponent(href), type };
            }
        });

        const spineRefs = Array.from(
            opf.querySelectorAll("spine > itemref"),
        ).map((ref) => ref.getAttribute("idref"));

        let combinedContent = "";
        const loadedCssHrefs = new Set<string>();

        for (const idref of spineRefs) {
            if (!idref) continue;
            const item = manifestItems[idref];
            if (item) {
                const itemFetchPath = currentObfFolder + item.href;
                const itemFile = currentZip.current.file(itemFetchPath);
                if (
                    itemFile &&
                    (item.type.includes("html") || item.type.includes("xml"))
                ) {
                    try {
                        const itemContent = await itemFile.async("text");
                        const processedContent = await processContentItem(
                            itemContent,
                            item.type,
                        );
                        combinedContent += `<div class="bok-chapter">${processedContent}</div>`;
                    } catch (e) {
                        console.warn(
                            `Failed to process spine item ${itemFetchPath}:`,
                            e,
                        );
                    }
                }
            }
        }

        for (const id in manifestItems) {
            const item = manifestItems[id];
            if (item.type.includes("css")) {
                const cssPath = currentObfFolder + item.href;
                if (!loadedCssHrefs.has(cssPath)) {
                    const cssFile = currentZip.current.file(cssPath);
                    if (cssFile) {
                        try {
                            currentStyle +=
                                (await cssFile.async("text")) + "\n";
                            loadedCssHrefs.add(cssPath);
                        } catch (e) {
                            console.warn(`Failed to load CSS ${cssPath}:`, e);
                        }
                    }
                }
            }
        }

        addStyling();
        setRawContent(combinedContent);
    }

    async function processContentItem(
        content: string,
        type: string,
    ): Promise<string> {
        // in some epubs the css is in the xhtml/file. sneaky fuckers
        // we want to process it before giving it free reign
        let allCss = [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
            .map((m) => m[1])
            .join("\n");

        allCss = stripUnneededRules(allCss);

        currentStyle += allCss;
        // we don't need the style, link or title tags. furthermore, link tags would cause
        // errors on the client because it wouldn't be able to find the files in the href.
        let processed = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
        processed = processed.replace(/<link[^>]*?>/gi, "");
        processed = processed.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "");
        processed = await cleanImages(processed, type);
        return processed;
    }

    function stripUnneededRules(allCss: string): string {
        // linine css could easily fuck things up for us, we don't want that
        const enemiesOfTheState = [
            "background-color",
            "color",
            "font-size",
            "font-family",
            "font-weight",
            "line-height",
            "text-align",
        ];

        return allCss
            .split(/}/)
            .map((block: string) => {
                const parts = block.split(/{/);
                const selectors = parts[0];
                const decls = parts[1];
                if (!decls) return "";

                const filtered = decls
                    .split(/;/)
                    .map((d: string) => d.trim())
                    .filter((d: string) => {
                        if (!d) return false;
                        return !enemiesOfTheState.some((prop) =>
                            new RegExp(`^${prop}*:`, "i").test(d),
                        );
                    })
                    .join("; ");

                return filtered ? `${selectors.trim()} { ${filtered}; }` : "";
            })
            .filter((rule: string) => Boolean(rule))
            .join("\n");
    }

    // --- Image Logic with Error Handling ---

    async function cleanImages(
        document: string,
        type: string,
    ): Promise<string> {
        const parser = new DOMParser();

        if (validTypes.includes(type)) {
            try {
                // Error handling for DOM parsing/serialization
                const newDocument = parser.parseFromString(
                    document,
                    type as DOMParserSupportedType,
                );
                const parserError = newDocument.querySelector("parsererror");
                if (parserError) {
                    // Error handling for malformed HTML/XML
                    console.warn(
                        "Parser error in content item during cleanImages, skipping.",
                        parserError.textContent,
                    );
                    return document;
                }

                const imgs = newDocument.querySelectorAll("img");
                for (const img of imgs) {
                    await formatImg(img);
                }
                const xmlImages = newDocument.querySelectorAll("image");
                for (const image of xmlImages) {
                    await formatXMLImage(image);
                }

                const seri = new XMLSerializer();
                const newDoc = seri.serializeToString(
                    newDocument.documentElement || newDocument,
                );
                return newDoc;
            } catch (error) {
                console.error(
                    "Error during cleanImages DOM processing:",
                    error,
                );
                return document;
            }
        } else return document;
    }

    async function formatImg(img: Element) {
        let src = img.getAttribute("src") as string;
        if (!src) return;

        while (src.startsWith(".") || src.startsWith("/")) src = src.slice(1);
        src = currentObfFolder + src;

        if (currentImages[src] === undefined) {
            const imgFile = currentZip.current?.file(src); // Error handling: Check if file exists
            if (imgFile) {
                try {
                    // Error handling for blob creation
                    const blob = await imgFile.async("blob");
                    const url = URL.createObjectURL(blob);
                    currentImages[src] = url;
                } catch (e) {
                    console.warn(
                        `Could not load image blob (formatImg) ${src}:`,
                        e,
                    );
                    currentImages[src] = ""; // Cache failure on error
                }
            } else {
                console.warn(`Image file not found in zip (formatImg): ${src}`);
                currentImages[src] = ""; // Cache failure if file not found
            }
        }
        img.setAttribute("src", currentImages[src]);
    }

    async function formatXMLImage(image: Element) {
        let src = image.getAttribute("xlink:href") as string;
        if (!src) return;

        while (src.startsWith(".") || src.startsWith("/")) src = src.slice(1);
        src = currentObfFolder + src;

        if (currentImages[src] === undefined) {
            const imgFile = currentZip.current?.file(src); // Error handling: Check if file exists
            if (imgFile) {
                try {
                    // Error handling for blob creation
                    const blob = await imgFile.async("blob");
                    const url = URL.createObjectURL(blob);
                    currentImages[src] = url;
                } catch (e) {
                    console.warn(
                        `Could not load image blob (formatXMLImage) ${src}:`,
                        e,
                    );
                    currentImages[src] = ""; // Cache failure on error
                }
            } else {
                console.warn(
                    `Image file not found in zip (formatXMLImage): ${src}`,
                );
                currentImages[src] = ""; // Cache failure if file not found
            }
        }
        image.setAttribute("xlink:href", currentImages[src]);
    }

    // --- End of Image Logic ---

    function addStyling() {
        if (!currentStyle.trim()) return;
        const styleBlob = new Blob([currentStyle], { type: "text/css" });
        const blobURL = URL.createObjectURL(styleBlob);
        styleLinkElement.current = document.createElement("link");
        styleLinkElement.current.href = blobURL;
        styleLinkElement.current.rel = "stylesheet";
        styleLinkElement.current.setAttribute("data-bok-reader-style", "true");
        document.head.appendChild(styleLinkElement.current);
    }

    return {
        title,
        rawContent,
        isLoading,
        error,
        loadEpub,
        setIsLoading,
    };
}
