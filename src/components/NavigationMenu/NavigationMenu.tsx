import React, { useState, useEffect, useCallback } from "react";
import { TocItem } from "../../hooks/useEpub";
import { calculatePageOfElement } from "../../helpful_functions/calculatePageOfElement";
import styles from "./NavigationMenu.module.css";

interface NavigationMenuProps {
    toc: TocItem[];
    currentPage: number;
    totalPages: number;
    onClose: () => void;
    onGoToPage: (page: number) => void;
    onChapterClick: (href: string) => void;
}

const NavigationMenu: React.FC<NavigationMenuProps> = ({
    toc,
    currentPage,
    totalPages,
    onClose,
    onGoToPage,
    onChapterClick
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [inputPage, setInputPage] = useState(currentPage + 1);
    const [pageMap, setPageMap] = useState<{[href: string]: number}>({});

    // Use rAF for smoother mount animation
    useEffect(() => {
        // Double rAF ensures the browser has painted the initial state
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        });
    }, []);

    useEffect(() => {
        const newPageMap: {[href: string]: number} = {};
        
        const processItems = (items: TocItem[]) => {
            items.forEach(item => {
                try {
                    const id = item.href.replace('#', '');
                    const element = document.getElementById(id);
                    
                    if (element) {
                        const page = calculatePageOfElement(element) + 1;
                        newPageMap[item.href] = page;
                    }
                } catch {
                    // Element might not be in DOM yet
                }
                
                if (item.subitems) {
                    processItems(item.subitems);
                }
            });
        };

        const calcTimer = setTimeout(() => {
            processItems(toc);
            setPageMap(newPageMap);
        }, 100);

        return () => clearTimeout(calcTimer);
    }, [toc]);

    useEffect(() => {
        setInputPage(currentPage + 1);
    }, [currentPage]);

    const handleClose = useCallback(() => {
        // Use rAF for smoother close animation
        requestAnimationFrame(() => {
            setIsVisible(false);
            setIsClosing(true);
        });
        
        // Match CSS transition duration (350ms)
        setTimeout(onClose, 350);
    }, [onClose]);

    const handleJump = useCallback(() => {
        const target = Math.max(1, Math.min(totalPages, inputPage));
        onGoToPage(target - 1);
    }, [inputPage, totalPages, onGoToPage]);

    const handleChapterClick = useCallback((href: string) => {
        onChapterClick(href);
        handleClose();
    }, [onChapterClick, handleClose]);

    const renderToc = (items: TocItem[], level = 0) => {
        return (
            <ul className={level === 0 ? styles['toc-list'] : styles['toc-sublist']}>
                {items.map((item, idx) => {
                    const pageNum = pageMap[item.href];
                    return (
                        <li key={idx}>
                            <div 
                                className={styles['toc-item']} 
                                onClick={() => handleChapterClick(item.href)}
                            >
                                <span className={styles['toc-label']}>{item.label}</span>
                                {pageNum !== undefined && (
                                    <span className={styles['toc-page-num']}>{pageNum}</span>
                                )}
                            </div>
                            {item.subitems && item.subitems.length > 0 && renderToc(item.subitems, level + 1)}
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <div 
            className={`${styles['nav-menu-overlay']} ${isClosing ? styles['fade-out'] : ''}`} 
            onClick={handleClose}
        >
            <div 
                className={`
                    ${styles['nav-menu']} 
                    ${isVisible ? styles['visible'] : ''} 
                    ${isClosing ? styles['slide-down'] : ''}
                `}
                onClick={e => e.stopPropagation()}
            >
                <div className={styles['nav-header']}>
                    <h2>Table of Contents</h2>
                    <button className={styles['close-btn']} onClick={handleClose}>&times;</button>
                </div>

                <div className={styles['toc-container']}>
                    {toc.length > 0 ? renderToc(toc) : (
                        <div style={{padding: '20px', textAlign: 'center', opacity: 0.5}}>
                            No chapters found
                        </div>
                    )}
                </div>

                <div className={styles['page-jumper']}>
                    <div className={styles['jumper-controls']}>
                        <input 
                            className={styles['jumper-input']}
                            type="number"
                            value={inputPage}
                            onChange={(e) => setInputPage(parseInt(e.target.value) || 1)}
                            onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                            onClick={(e) => e.currentTarget.select()}
                        />
                        <span className={styles['total-pages']}>of {totalPages}</span>
                        <button className={styles['go-btn']} onClick={handleJump}>Go</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NavigationMenu;
