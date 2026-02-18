import JSZip from "jszip";
import { useState, useCallback, useRef } from "react";

// 1. New Types for the Table of Contents
export type TocItem = {
    label: string;
    href: string; // Internal link (#chapterId_elementId)
    subitems: TocItem[];
};

type BlobImages = { [key: string]: string };

function normalizeMetadataValue(value: string | null | undefined): string {
    if (!value) return "";
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getMetadataText(opf: Document, selector: string): string {
    const element = opf.querySelector(selector);
    return normalizeMetadataValue(element?.textContent);
}

function getCanonicalBookIdentity(opf: Document): string {
    const packageElement = opf.querySelector("package");
    const uniqueIdentifierId = packageElement?.getAttribute("unique-identifier")?.trim() ?? "";

    const identifiers = Array.from(
        opf.querySelectorAll("metadata > dc\\:identifier, metadata > identifier")
    );

    let identifier = "";
    if (uniqueIdentifierId) {
        const matchedIdentifier = identifiers.find((item) => item.getAttribute("id") === uniqueIdentifierId);
        identifier = normalizeMetadataValue(matchedIdentifier?.textContent);
    }

    if (!identifier && identifiers.length > 0) {
        identifier = normalizeMetadataValue(identifiers[0].textContent);
    }

    if (identifier) {
        return `id=${identifier}`;
    }

    const title = getMetadataText(opf, "metadata > dc\\:title, metadata > title");
    const creator = getMetadataText(opf, "metadata > dc\\:creator, metadata > creator");
    const language = getMetadataText(opf, "metadata > dc\\:language, metadata > language");
    const publisher = getMetadataText(opf, "metadata > dc\\:publisher, metadata > publisher");

    const fallbackIdentity = `title=${title}|creator=${creator}|language=${language}|publisher=${publisher}`;
    return fallbackIdentity === "title=|creator=|language=|publisher="
        ? "unknown-book"
        : fallbackIdentity;
}

async function hashToHex(input: string): Promise<string> {
    if (globalThis.crypto?.subtle && typeof TextEncoder !== "undefined") {
        const encoded = new TextEncoder().encode(input);
        const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    // Fallback for environments without Web Crypto
    let hash = 5381;
    for (let i = 0; i < input.length; i += 1) {
        hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

async function createBookId(opf: Document): Promise<string> {
    const canonicalIdentity = getCanonicalBookIdentity(opf);
    const hash = await hashToHex(canonicalIdentity);
    return `bok_${hash.slice(0, 32)}`;
}

function resolvePath(base: string, relative: string) {
    const stack = base.split("/");
    stack.pop();
    const parts = relative.split("/");
    for (const part of parts) {
        if (part === ".") continue;
        if (part === "..") stack.pop();
        else stack.push(part);
    }
    return stack.join("/");
}

export default function useEpub() {
    const [rawContent, setRawContent] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [title, setTitle] = useState("");
    const [bookId, setBookId] = useState("");
    const [toc, setToc] = useState<TocItem[]>([]); // 2. State for TOC
    const [error, setError] = useState<string | null>(null);

    let currentObfFolder = "";
    let currentStyle = "";
    const currentZip = useRef<JSZip | null>(null);
    const styleLinkElement = useRef<HTMLLinkElement | null>(null);
    const currentImages: BlobImages = {};

    const loadEpub = useCallback(
        async (source: File | ArrayBuffer | string) => {
            setIsLoading(true);
            setRawContent("");
            setToc([]);
            setTitle("Loading...");
            setBookId("");
            setError(null);

            if (styleLinkElement.current) {
                document.head.removeChild(styleLinkElement.current);
                URL.revokeObjectURL(styleLinkElement.current.href);
                styleLinkElement.current = null;
            }

            try {
                let buffer: ArrayBuffer;
                if (typeof source === "string") {
                    const response = await fetch(source);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    buffer = await response.arrayBuffer();
                } else if (source instanceof File) {
                    buffer = await source.arrayBuffer();
                } else {
                    buffer = source;
                }

                if (!buffer || buffer.byteLength === 0) throw new Error("EPUB source is empty.");

                currentZip.current = await JSZip.loadAsync(buffer);
                await readContainer();
            } catch (err: unknown) {
                console.error("Error processing EPUB source:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
                setIsLoading(false);
            }
        },
        []
    );

    async function readContainer() {
        if (!currentZip.current) throw new Error("Zip not loaded");

        const containerFile = currentZip.current.file("META-INF/container.xml");
        if (!containerFile) throw new Error("META-INF/container.xml not found.");

        const containerContent = await containerFile.async("text");
        const parser = new DOMParser();
        const containerDOM = parser.parseFromString(containerContent, "application/xml");
        const rootfile = containerDOM.querySelector('rootfile[media-type="application/oebps-package+xml"]');
        const opfPath = rootfile?.getAttribute("full-path");

        if (!opfPath) throw new Error("OPF file path not found.");

        currentObfFolder = opfPath.substring(0, opfPath.lastIndexOf("/") + 1);
        const opfFile = currentZip.current.file(opfPath);
        if (!opfFile) throw new Error(`OPF file not found at path: ${opfPath}`);

        const opfContent = await opfFile.async("text");
        const parsedOpf = parser.parseFromString(opfContent, "application/xml");

        if (parsedOpf.querySelector("parsererror")) throw new Error("Error parsing OPF file.");

        getTitle(parsedOpf);
        setBookId(await createBookId(parsedOpf));
        await parseManifestAndSpine(parsedOpf);
    }

    function getTitle(opf: Document) {
        const titleElement = opf.querySelector("metadata > dc\\:title") || opf.querySelector("metadata > title");
        setTitle(titleElement?.textContent || "Untitled Book");
    }

    async function parseManifestAndSpine(opf: Document) {
        if (!currentZip.current) return;

        // 3. Updated Manifest extraction to include 'properties' (needed for EPUB 3 TOC)
        const manifestItems: { [id: string]: { href: string; type: string; properties: string | null } } = {};
        const hrefToId: { [href: string]: string } = {};

        opf.querySelectorAll("manifest > item").forEach((item) => {
            const id = item.getAttribute("id");
            const href = item.getAttribute("href");
            const type = item.getAttribute("media-type");
            const properties = item.getAttribute("properties"); // Capture properties
            if (id && href && type) {
                const decodedHref = decodeURIComponent(href);
                manifestItems[id] = { href: decodedHref, type, properties };
                hrefToId[decodedHref] = id;
            }
        });

        await parseTableOfContents(opf, manifestItems, hrefToId);

        const spineRefs = Array.from(opf.querySelectorAll("spine > itemref")).map((ref) => ref.getAttribute("idref"));

        let combinedContent = "";
        const loadedCssHrefs = new Set<string>();

        for (const idref of spineRefs) {
            if (!idref) continue;
            const item = manifestItems[idref];
            if (item && (item.type.includes("html") || item.type.includes("xml"))) {
                try {
                    const itemFetchPath = currentObfFolder + item.href;
                    const itemFile = currentZip.current.file(itemFetchPath);
                    if (itemFile) {
                        const itemContent = await itemFile.async("text");

                        const processedContent = await processContentItem(
                            itemContent,
                            item.type,
                            idref,
                            item.href,
                            hrefToId
                        );
                        combinedContent += `<div class="bok-chapter" id="${idref}">${processedContent}</div>`;
                    }
                } catch (e) {
                    console.warn(`Failed to process spine item ${item.href}:`, e);
                }
            }
        }

        // Process CSS
        for (const id in manifestItems) {
            const item = manifestItems[id];
            if (item.type.includes("css")) {
                const cssPath = currentObfFolder + item.href;
                if (!loadedCssHrefs.has(cssPath)) {
                    const cssFile = currentZip.current.file(cssPath);
                    if (cssFile) {
                        const rawCss = await cssFile.async("text");
                        currentStyle += stripUnneededRules(rawCss) + "\n";
                        loadedCssHrefs.add(cssPath);
                    }
                }
            }
        }

        addStyling();
        setRawContent(combinedContent);
        // i had this set to on before, and it would cause the loading screen to 
        // pop in and out before the previous reading position is made. 
        // hopefully it doesn't cause any bugs to leave this like now
        // "For I know the plans I have for you," declares the LORD, "plans to prosper you and not to harm you, plans to give you hope and a future." - Jeremiah 29:11 
        //setIsLoading(false);
    }

    async function parseTableOfContents(
        opf: Document,
        manifestItems: { [id: string]: { href: string; type: string; properties: string | null } },
        hrefToId: { [href: string]: string }
    ) {
        let tocId = null;
        let tocItem = null;

        // Try EPUB 3 (Navigation Document)
        // Look for item with properties="nav"
        const navItemKey = Object.keys(manifestItems).find(key =>
            manifestItems[key].properties && manifestItems[key].properties?.includes("nav")
        );

        if (navItemKey) {
            tocItem = manifestItems[navItemKey];
        } else {
            // Try EPUB 2 (NCX)
            const spine = opf.querySelector("spine");
            tocId = spine?.getAttribute("toc");
            if (tocId && manifestItems[tocId]) {
                tocItem = manifestItems[tocId];
            }
        }

        if (!tocItem || !currentZip.current) {
            console.log("No TOC found.");
            return;
        }

        const tocPath = currentObfFolder + tocItem.href;
        const tocFile = currentZip.current.file(tocPath);

        if (!tocFile) return;

        const tocContent = await tocFile.async("text");
        const parser = new DOMParser();
        const tocDoc = parser.parseFromString(tocContent, "application/xml"); // generic xml parsing works for html too usually

        let parsedToc: TocItem[] = [];

        if (tocItem.type.includes("ncx")) {
            // EPUB 2 NCX Parser
            const navPoints = Array.from(tocDoc.querySelectorAll("navMap > navPoint"));

            const parseNcxNodes = (nodes: Element[]): TocItem[] => {
                return nodes.map(node => {
                    const label = node.querySelector("navLabel > text")?.textContent || "Unnamed";
                    const contentSrc = node.querySelector("content")?.getAttribute("src") || "";

                    // Recursion
                    const childNodes = Array.from(node.children).filter(c => c.tagName.toLowerCase() === "navpoint");

                    return {
                        label,
                        href: resolveTocHref(contentSrc, tocItem!.href, hrefToId),
                        subitems: parseNcxNodes(childNodes)
                    };
                });
            };
            parsedToc = parseNcxNodes(navPoints);

        } else {
            // EPUB 3 HTML Nav Parser
            // Usually <nav epub:type="toc"> -> <ol> -> <li> -> <a>
            const navRoot = tocDoc.querySelector("nav[epub\\:type='toc']") || tocDoc.querySelector("nav");
            const ol = navRoot?.querySelector("ol");

            const parseHtmlNodes = (list: Element | null): TocItem[] => {
                if (!list) return [];
                return Array.from(list.children).filter(c => c.tagName.toLowerCase() === "li").map(li => {
                    const anchor = li.querySelector(":scope > a") || li.querySelector(":scope > span"); // Sometimes it's a span if not clickable
                    const label = anchor?.textContent?.trim() || "Unnamed";
                    const href = anchor?.getAttribute("href") || "";
                    const childOl = li.querySelector(":scope > ol");

                    return {
                        label,
                        href: resolveTocHref(href, tocItem!.href, hrefToId),
                        subitems: parseHtmlNodes(childOl)
                    };
                });
            };

            if (ol) parsedToc = parseHtmlNodes(ol);
        }

        console.log("Parsed TOC:", parsedToc);
        setToc(parsedToc);
    }

    // Helper to turn file paths into your internal #IDs
    function resolveTocHref(rawHref: string, tocFileHref: string, hrefToId: { [href: string]: string }): string {
        if (!rawHref) return "";
        const [path, hash] = rawHref.split("#");

        // The TOC link is relative to the TOC file location, we need to make it relative to root to find the ID
        const resolvedPath = resolvePath(tocFileHref, path);

        const targetId = hrefToId[resolvedPath];
        if (!targetId) return ""; // Broken link or points to something not in manifest

        return hash ? `#${targetId}_${hash}` : `#${targetId}`;
    }

    async function processContentItem(
        content: string,
        type: string,
        currentId: string,
        currentPath: string,
        hrefToId: { [href: string]: string }
    ): Promise<string> {
        let allCss = [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
            .map((m) => m[1])
            .join("\n");
        allCss = stripUnneededRules(allCss);
        currentStyle += allCss;

        let processed = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
        processed = processed.replace(/<link[^>]*?>/gi, "");
        processed = processed.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "");

        processed = await manipulateDom(processed, type, currentId, currentPath, hrefToId);

        return processed;
    }

    async function manipulateDom(
        documentStr: string,
        type: string,
        currentId: string,
        currentPath: string,
        hrefToId: { [href: string]: string }
    ): Promise<string> {
        const parser = new DOMParser();
        const newDocument = parser.parseFromString(documentStr, type as DOMParserSupportedType);

        if (newDocument.querySelector("parsererror")) {
            console.warn("Parser error in manipulateDom");
            return documentStr;
        }

        const allElementsWithId = newDocument.querySelectorAll("[id]");
        for (const el of allElementsWithId) {
            const oldId = el.getAttribute("id");
            el.setAttribute("id", `${currentId}_${oldId}`);
        }

        const allAnchors = newDocument.querySelectorAll("a[href]");
        for (const anchor of allAnchors) {
            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("http") || href.startsWith("mailto")) continue;

            if (href.startsWith("#")) {
                const targetId = href.substring(1);
                anchor.setAttribute("href", `#${currentId}_${targetId}`);
            } else {
                const [targetPath, targetHash] = href.split("#");
                const resolvedPath = resolvePath(currentPath, targetPath);
                const targetChapterId = hrefToId[resolvedPath];

                if (targetChapterId) {
                    if (targetHash) {
                        anchor.setAttribute("href", `#${targetChapterId}_${targetHash}`);
                    } else {
                        anchor.setAttribute("href", `#${targetChapterId}`);
                    }
                }
            }
        }

        const imgs = newDocument.querySelectorAll("img");
        for (const img of imgs) await formatImg(img);

        const xmlImages = newDocument.querySelectorAll("image");
        for (const image of xmlImages) await formatXMLImage(image);

        const seri = new XMLSerializer();
        return seri.serializeToString(newDocument.documentElement || newDocument);
    }

    async function formatImg(img: Element) {
        let src = img.getAttribute("src");
        if (!src) return;
        while (src.startsWith(".") || src.startsWith("/")) src = src.slice(1);
        src = currentObfFolder + src;
        await resolveImageSrc(img, "src", src);
    }

    async function formatXMLImage(image: Element) {
        let src = image.getAttribute("xlink:href");
        if (!src) return;
        while (src.startsWith(".") || src.startsWith("/")) src = src.slice(1);
        src = currentObfFolder + src;
        await resolveImageSrc(image, "xlink:href", src);
    }

    async function resolveImageSrc(element: Element, attribute: string, src: string) {
        if (currentImages[src] === undefined) {
            const imgFile = currentZip.current?.file(src);
            if (imgFile) {
                try {
                    const blob = await imgFile.async("blob");
                    currentImages[src] = URL.createObjectURL(blob);
                } catch (e) {
                    currentImages[src] = "";
                }
            } else {
                currentImages[src] = "";
            }
        }
        element.setAttribute(attribute, currentImages[src]);
    }

    function stripUnneededRules(allCss: string): string {
        const enemiesOfTheState = [
            "background-color", "color", "font-size", "font-family",
            "font-weight", "line-height", "text-align", "margin", "padding"
        ];

        let css = allCss.replace(/\/\*[\s\S]*?\*\//g, "");
        css = css.replace(/(^|[^.#\w-])(html|body)(?![\w-])/gi, "butt-sex-masterr");

        for (const prop of enemiesOfTheState) {
            const escaped = prop.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
            const propRegex = new RegExp(`${escaped}(?:-[\\w-]+)?\\s*:[^;{}]*;?`, 'gi');
            css = css.replace(propRegex, '');
        }

        css = css.replace(/[^{}@]+\{\s*\}/g, '');
        css = css.replace(/@media[^{]*\{\s*\}/g, '');
        css = css.replace(/\n\s*\n/g, '\n');

        return css.trim();
    }

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

    return { title, bookId, rawContent, toc, isLoading, error, loadEpub, setIsLoading };
}
