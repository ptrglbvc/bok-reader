import { useState, useEffect, Dispatch, SetStateAction } from "react";

function usePersistentState<T>(
    key: string, 
    initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
    
    const [value, setValue] = useState<T>(() => {
        if (typeof window === "undefined") return initialValue;
        
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    useEffect(() => {
        try {
            if (value !== undefined) {
                localStorage.setItem(key, JSON.stringify(value));
            }
        } catch (error) {
            console.warn(`Error saving localStorage key "${key}":`, error);
        }
    }, [key, value]);

    return [value, setValue];
}

export default usePersistentState;
