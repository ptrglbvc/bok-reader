export function calculatePageOfElement(element: HTMLElement) {
    const bookElement = document.getElementById("bok-main-element");
    if (bookElement !== null) {
        const pageWidth = bookElement.getBoundingClientRect().width
        // Get element's position relative to its offset parent
        const elementOffsetLeft = element.offsetLeft;
        return Math.round(elementOffsetLeft/pageWidth);
    }
    else throw Error;
}
