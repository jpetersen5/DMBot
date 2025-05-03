import React, { useState, useEffect, useRef } from "react";

interface DraggableProps {
  children: React.ReactNode;
  handleSelector?: string;
}

const Draggable: React.FC<DraggableProps> = ({ children, handleSelector }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLElement | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPositionSet = useRef(false);

  useEffect(() => {
    if (handleSelector && dragRef.current) {
      handleRef.current = dragRef.current.querySelector(handleSelector);
      handleRef.current?.classList.add("draggable-handle-element");
    } else {
      handleRef.current = dragRef.current;
    }

    if (!initialPositionSet.current && dragRef.current) {
      const rect = dragRef.current.getBoundingClientRect();
      setPosition({
        x: (window.innerWidth - rect.width) / 2,
        y: (window.innerHeight - rect.height) / 2
      });
      initialPositionSet.current = true;
    }
  }, [handleSelector]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const checkElement = handleSelector && handleRef.current ? handleRef.current : dragRef.current;

    if (checkElement && checkElement.contains(e.target as Node)) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  useEffect(() => {
    const currentDragRef = dragRef.current;

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      currentDragRef?.classList.add("is-dragging");
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      currentDragRef?.classList.remove("is-dragging");
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      currentDragRef?.classList.remove("is-dragging");
    };
  }, [isDragging]);

  return (
    <div
      ref={dragRef}
      className="draggable-container"
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        userSelect: "none",
        zIndex: 1000
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  );
};

export default Draggable;