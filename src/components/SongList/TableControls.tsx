import React, { useEffect, useState } from "react";

interface TableControlsProps {
  perPage: number;
  setPerPage: React.Dispatch<React.SetStateAction<number>>;
  setPage?: React.Dispatch<React.SetStateAction<number>>;
}

export const TableControls: React.FC<TableControlsProps> = ({ perPage, setPerPage, setPage }) => {
  const handlePerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPerPage(parseInt(e.target.value));
    if (setPage) setPage(1);
  };

  return (
    <div className="table-controls">
      <div>
        <label htmlFor="per-page">Songs per page:</label>
        <select id="per-page" value={perPage} onChange={handlePerPageChange}>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>
    </div>
  );
};

interface PaginationProps {
  page: number;
  inputPage: string;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  setInputPage: React.Dispatch<React.SetStateAction<string>>;
  size?: "sm" | "lg";
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  inputPage,
  totalPages,
  setPage,
  setInputPage,
  size = "lg"
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
      <button
        onClick={handlePrevPage}
        disabled={page === 1}
        className="prev"
      >
        {size === "lg" && "Previous"}
        {size === "sm" && "←"}
      </button>
      <span className="pages">
        {size === "lg" && "Page "} <input
          type="number" 
          value={inputPage} 
          onChange={handlePageInputChange}
          onBlur={handlePageInputUpdate}
          onKeyDown={handlePageInputKeyPress}
          min={1} 
          max={totalPages} 
        /> of {totalPages}
      </span>
      <button
        onClick={handleNextPage}
        disabled={page === totalPages}
        className="next"
      >
        {size === "lg" && "Next"}
        {size === "sm" && "→"}
      </button>
    </div>
  );
};

interface SearchProps {
  search: string;
  filter: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  submitSearch: () => void;
}

export const Search: React.FC<SearchProps> = ({
  search,
  filter,
  setSearch,
  setFilter,
  submitSearch
}) => {
  const [previousSearch, setPreviousSearch] = useState(search);

  useEffect(() => {
    setPreviousSearch(search);
  }, [search]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilter(e.target.value);
    if (search.trim() !== "") {
      submitSearch();
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      submitSearch();
    }
  };

  const handleBlur = () => {
    if (search !== previousSearch) {
      submitSearch();
    }
  };

  return (
    <div className="search-controls">
      <input
        type="text"
        value={search}
        onChange={handleSearchChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyPress}
        placeholder="Search..."
      />
      <select value={filter} onChange={handleFilterChange}>
        <option value="">All fields</option>
        <option value="name">Name</option>
        <option value="artist">Artist</option>
        <option value="album">Album</option>
        <option value="year">Year</option>
        <option value="genre">Genre</option>
        <option value="charter">Charter</option>
      </select>
    </div>
  );
};