import React from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  inputPage: string;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPageInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPageInputUpdate: () => void;
  onPageInputKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  inputPage,
  onPrevPage,
  onNextPage,
  onPageInputChange,
  onPageInputUpdate,
  onPageInputKeyPress
}) => (
  <div className="pagination">
    <button onClick={onPrevPage} disabled={page === 1}>Previous</button>
    <span>
      Page <input 
        type="number" 
        value={inputPage} 
        onChange={onPageInputChange}
        onBlur={onPageInputUpdate}
        onKeyDown={onPageInputKeyPress}
        min={1} 
        max={totalPages} 
      /> of {totalPages}
    </span>
    <button onClick={onNextPage} disabled={page === totalPages}>Next</button>
  </div>
);

export default Pagination;