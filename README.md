# bok

A React component library for reading EPUB files. Built with React, TypeScript, and Vite.

The reader that is spawned will render a column view, with each column representing a page of the book. The user is able to change the font size, font family, side margin and toggle the reader in fullscreen.

Butt.

## Installation

```bash
npm install bok
# or
yarn add bok
```

## Usage

```jsx
import React from "react";
import { BokReader } from "bok-reader";

function MyBookViewer() {
    const epubUrl = "https://www.path.com/to/your/book.epub"; // Can be a URL, File object, or ArrayBuffer

    return (
        <div style={{
            height: "100vh",
            width: "100vw",
        }}>
            <BokReader epubDataSource={epubUrl} />
        </div>
    );
}

export default MyBookViewer;
```

## Props to BokReader

-   `epubDataSource`: `File | ArrayBuffer | string | null` - The source of the EPUB file (File object, ArrayBuffer, or URL string).
-   `onTitleChange?`: `(title: string) => void` - Callback when the book title is loaded.
-   `onLoadingChange?`: `(isLoading: boolean) => void` - Callback when the loading state changes.
-   `onError?`: `(errorMsg: string) => void` - Callback when an error occurs during loading or processing.
-   `onSyncEvent?`: `(event: BokReaderSyncEvent) => void` - Emits semantic local mutations for sync queues (`progress.set`, `highlight.add`, `highlight.remove`, `highlight.updateColor`).
-   `syncState?`: `BokReaderSyncState | null` - Host-provided remote/hydrated state for the current `bookId`.
-   `onConflictDetected?`: `(conflict: BokReaderSyncConflict) => void` - Called when incoming `syncState` conflicts with non-empty local data and `forceApply` is not set.
-   `supportedFonts?`: `{ displayName: string; name: string }[]` - Array of custom fonts to make available in the options menu.
-   `defaultFontFamily?`: `string` - Default reader font family used only when `bok_global_font_family` is not already set in localStorage (falls back to `"Courier New"`).
-   `color?`: `string` - Hexadecimal value. Color tint of the component.
-   `style?`: `React.CSSProperties` - Optional inline styles for the main wrapper component.

## Imperative Sync API (ref)

`BokReader` exposes a ref handle:

-   `getSyncSnapshot(): BokReaderSyncSnapshot | null`
-   `applySyncState(syncState: BokReaderSyncState, options?: { forceApply?: boolean }): boolean` (`true` means accepted: applied now or queued until reader is ready)
-   `getPendingSyncEvents(): BokReaderSyncEvent[]`
-   `acknowledgeSyncEvents(mutationIds: string | string[]): void`

## Development Scripts

-   `npm run dev`: Start development server.
-   `npm run build`: Build the library for production.
-   `npm run lint`: Lint the project files.
-   `npm run preview`: Preview the production build locally.

## Dependencies

-   jszip

## Peer Dependencies

-   react >=18.3.1
-   react-dom >=18.3.1
