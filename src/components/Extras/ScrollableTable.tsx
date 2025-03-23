import React, { useEffect, useRef, useState } from "react";

interface ScrollableTableProps {
  children: React.ReactNode;
  className?: string;
}

const ScrollableTable: React.FC<ScrollableTableProps> = ({ children, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrollableTop, setIsScrollableTop] = useState(false);
  const [isScrollableBottom, setIsScrollableBottom] = useState(false);

  const updateScrollIndicators = () => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const hasVerticalScroll = scrollHeight > clientHeight;
    
    // Only add scroll indicators if there's scrollable content
    if (hasVerticalScroll) {
      // Show top indicator if not at the top
      setIsScrollableTop(scrollTop > 2);
      
      // Show bottom indicator if not at the bottom
      setIsScrollableBottom(scrollTop + clientHeight < scrollHeight - 2);
    } else {
      setIsScrollableTop(false);
      setIsScrollableBottom(false);
    }
  };

  // Measure the header height and set the top arrow position
  const updateHeaderHeight = () => {
    const container = containerRef.current;
    if (!container) return;

    // Find the table header element
    const thead = container.querySelector("thead");
    if (thead) {
      const theadHeight = thead.getBoundingClientRect().height;
      container.style.setProperty("--header-height", `${theadHeight + 10}px`);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial measurement and check
    updateHeaderHeight();
    updateScrollIndicators();

    // Set up scroll event listener
    container.addEventListener("scroll", updateScrollIndicators);

    // Set up resize observer to handle content changes
    const resizeObserver = new ResizeObserver(() => {
      updateHeaderHeight();
      updateScrollIndicators();
    });

    resizeObserver.observe(container);

    // Handle window resize as well
    window.addEventListener("resize", () => {
      updateHeaderHeight();
      updateScrollIndicators();
    });
    
    // Set a timer to check again after content may have loaded
    const timer = setTimeout(() => {
      updateHeaderHeight();
      updateScrollIndicators();
    }, 500);

    return () => {
      container.removeEventListener("scroll", updateScrollIndicators);
      window.removeEventListener("resize", updateHeaderHeight);
      resizeObserver.disconnect();
      clearTimeout(timer);
    };
  }, []);

  // Also update when children change
  useEffect(() => {
    // Check again after a short delay to account for rendering
    const timer = setTimeout(() => {
      updateHeaderHeight();
      updateScrollIndicators();
    }, 100);
    return () => clearTimeout(timer);
  }, [children]);

  const containerClasses = [
    "table-container",
    className,
    isScrollableTop ? "scrollable-top" : "",
    isScrollableBottom ? "scrollable-bottom" : ""
  ].filter(Boolean).join(" ");

  return (
    <div 
      ref={containerRef}
      className={containerClasses}
      onScroll={updateScrollIndicators}
    >
      {children}
    </div>
  );
};

export default ScrollableTable; 