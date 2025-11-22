import { useEffect } from "react";

export default function useLocalStorage(
    title: string,
    percentRead: number,
    padding: number,
    fontSize: number,
    fontFamily: string,
) {
    let json = "";
    useEffect(() => {
        if (percentRead > 0.0000001) {
            /* eslint-disable */
            // eslint complains that it's not going persist between rerenders'
            // eslint complains a lot
            // its like my wife
            // wait
            // i dont have a wife
            // who am I
            // what am I doing
            json = JSON.stringify({
                percentRead: percentRead,
                padding: padding,
                fontSize: fontSize,
                fontFamily: fontFamily,
            });
            /* eslint-enable */
            localStorage.setItem(title, json);
        }
    }, [title, percentRead, padding, fontSize, fontFamily]);
}
