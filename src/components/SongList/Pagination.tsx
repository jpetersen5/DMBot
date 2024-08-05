import React, { useEffect } from "react";

interface PaginationProps {
  page: number;
  inputPage: string;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  setInputPage: React.Dispatch<React.SetStateAction<string>>;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  inputPage,
  totalPages,
  setPage,
  setInputPage,
}) => {
  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPage(e.target.value);
  };

  const handlePageInputUpdate = () => {
    const newPage = parseInt(inputPage, 10);
    if (!isNaN(newPage) && newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    } else {
      setInputPage(page.toString());
    }
  };

  const handlePageInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handlePageInputUpdate();
    }
  };

  useEffect(() => {
    setInputPage(page.toString());
  }, [page]);

  return (
    <div className="pagination">
      <button onClick={handlePrevPage} disabled={page === 1}>Previous</button>
      <span>
        Page <input 
          type="number" 
          value={inputPage} 
          onChange={handlePageInputChange}
          onBlur={handlePageInputUpdate}
          onKeyDown={handlePageInputKeyPress}
          min={1} 
          max={totalPages} 
        /> of {totalPages}
      </span>
      <button onClick={handleNextPage} disabled={page === totalPages}>Next</button>
    </div>
  );
};

export default Pagination;