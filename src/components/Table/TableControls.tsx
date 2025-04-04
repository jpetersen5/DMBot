import React, { useState, useRef, useEffect } from "react";
import { useClickOutside } from "../../utils/handleClickOutside";
import { capitalize } from "../../utils/safeHTML";
import "./TableControls.scss";

import FilterIcon from "../../assets/filter.svg";

export interface PaginationProps {
  page: number;
  totalPages: number;
  inputPage: string;
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
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPage(e.target.value);
  };

  const handlePageInputUpdate = () => {
    const newPage = parseInt(inputPage, 10);
    if (!isNaN(newPage)) {
      if (newPage < 1) {
        setInputPage("1");
        setPage(1);
      } else if (newPage > totalPages) {
        setInputPage(totalPages.toString());
        setPage(totalPages);
      } else {
        setPage(newPage);
      }
    }
  };

  const handlePageInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handlePageInputUpdate();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.currentTarget.blur();
    } else if (e.key === "ArrowUp") {
      handleNextPage();
    } else if (e.key === "ArrowDown") {
      handlePrevPage();
    }
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.currentTarget.select();
  };

  const handleBlur = () => {
    handlePageInputUpdate();

    const newPage = parseInt(inputPage, 10);
    if (isNaN(newPage)) {
      setInputPage(page.toString());
    }
  };

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  useEffect(() => {
    setInputPage(page.toString());
  }, [page, setInputPage]);

  return (
    <div className={`pagination ${size === "sm" ? "size-sm" : "size-lg"}`}>
      <button 
        onClick={handlePrevPage} 
        disabled={page === 1 || totalPages === 0} 
        className="prev"
      >
        <span className="paginate-large">Previous</span>
        <span className="paginate-small">←</span>
      </button>
      <div className="pages">
        <span className="paginate-large">Page&nbsp;</span>
        <input
          className="paginate-large"
          type="text"
          pattern="[0-9]*"
          value={inputPage}
          onChange={handlePageInputChange}
          onBlur={handleBlur}
          onKeyDown={handlePageInputKeyPress}
          onClick={handleInputClick}
          min={1}
          max={totalPages}
          disabled={totalPages === 0}
        />
        <span className="paginate-small">{totalPages > 0 ? inputPage : "0"}&nbsp;</span>
        <span>{`of ${totalPages}`}</span>
      </div>
      <button 
        onClick={handleNextPage} 
        disabled={page === totalPages || totalPages === 0} 
        className="next"
      >
        <span className="paginate-large">Next</span>
        <span className="paginate-small">→</span>
      </button>
    </div>
  );
};

export interface TableControlsProps {
  perPage: number;
  setPerPage: React.Dispatch<React.SetStateAction<number>>;
  setPage?: React.Dispatch<React.SetStateAction<number>>;
  options?: number[];
}

export const PerPageSelector: React.FC<TableControlsProps> = ({ 
  perPage, 
  setPerPage, 
  setPage,
  options = [10, 20, 50, 100]
}) => {
  const handlePerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPerPage(parseInt(e.target.value));
    if (setPage) setPage(1);
  };

  return (
    <div className="per-page-selector">
      <label htmlFor="per-page">Per page:</label>
      <select id="per-page" value={perPage} onChange={handlePerPageChange}>
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
};

export interface SearchProps {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  filters?: string[];
  setFilters?: React.Dispatch<React.SetStateAction<string[]>>;
  filterOptions?: { value: string; label: string }[];
  onSearch?: () => void;
  placeholder?: string;
}

export const Search: React.FC<SearchProps> = ({
  search,
  setSearch,
  filters,
  setFilters,
  filterOptions,
  onSearch,
  placeholder = "Search..."
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onSearch) {
      onSearch();
    }
  };

  return (
    <div className="search-controls">
      <div className="search-input-container">
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
        />
        {filters && filterOptions && setFilters && (
          <FilterDropdown
            filters={filters}
            filterOptions={filterOptions}
            setFilters={setFilters}
          />
        )}
      </div>
      {onSearch && (
        <button className="search-button" onClick={onSearch}>
          Search
        </button>
      )}
    </div>
  );
};

interface FilterDropdownProps {
  filters: string[];
  filterOptions: { value: string; label: string }[];
  setFilters: React.Dispatch<React.SetStateAction<string[]>>;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  filters,
  filterOptions,
  setFilters
}) => {
  const [filtersToSet, setFiltersToSet] = useState<string[]>(filters);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleFilterToggle = (filter: string) => {
    setFiltersToSet(prevFilters => 
      prevFilters.includes(filter)
        ? prevFilters.filter(f => f !== filter)
        : [...prevFilters, filter]
    );
  };

  const handleClearFilters = () => {
    setFiltersToSet([]);
    setFilters([]);
    setIsDropdownOpen(false);
  };

  const handleDropdownClose = () => {
    setFilters(filtersToSet);
    setIsDropdownOpen(false);
  };

  useClickOutside(dropdownRef, handleDropdownClose);

  useEffect(() => {
    setFiltersToSet(filters);
  }, [filters]);

  return (
    <>
      <button 
        className="filter-button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        aria-label="Filter options"
      >
        <img src={FilterIcon} alt="Filter" />
      </button>
      {isDropdownOpen && (
        <div className="filter-dropdown" ref={dropdownRef}>
          {filterOptions.map(option => (
            <label key={option.value} className="filter-option">
              <input
                type="checkbox"
                checked={filtersToSet.includes(option.value)}
                onChange={() => handleFilterToggle(option.value)}
              />
              {option.label}
            </label>
          ))}
          <button onClick={handleClearFilters} className="clear-filters-button">
            Clear filters
          </button>
        </div>
      )}
    </>
  );
};

export interface MultiSelectDropdownProps {
  options: string[];
  selectedOptions: string[];
  setSelectedOptions: React.Dispatch<React.SetStateAction<string[]>>;
  label: string;
  clearLabel: string;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selectedOptions,
  setSelectedOptions,
  label,
  clearLabel,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleOptionToggle = (option: string) => {
    setSelectedOptions(prevOptions => 
      prevOptions.includes(option)
        ? prevOptions.filter(o => o !== option)
        : [...prevOptions, option]
    );
  };

  const handleClearOptions = () => {
    setSelectedOptions([]);
    setIsDropdownOpen(false);
  };

  const handleDropdownClose = () => {
    setIsDropdownOpen(false);
  };

  useClickOutside(dropdownRef, handleDropdownClose);

  return (
    <div className="multi-select-dropdown">
      <button 
        className="dropdown-button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        {selectedOptions.length === 0 && clearLabel}
        {selectedOptions.length === 1 && 
          capitalize(selectedOptions[0])
        }
        {selectedOptions.length > 1 &&
          selectedOptions.length < options.length &&
          `${label} (${selectedOptions.length})`
        }
        {selectedOptions.length === options.length && `All ${label}`}
      </button>
      {isDropdownOpen && (
        <div className="dropdown-menu" ref={dropdownRef}>
          {options.map(option => (
            <label key={option} className="dropdown-option">
              <input
                type="checkbox"
                checked={selectedOptions.includes(option)}
                onChange={() => handleOptionToggle(option)}
              />
              <span>{capitalize(option)}</span>
            </label>
          ))}
          <button onClick={handleClearOptions} className="clear-options-button">
            Clear {label}
          </button>
        </div>
      )}
    </div>
  );
};

export interface TableToolbarProps {
  search?: SearchProps;
  pagination?: PaginationProps;
  perPage?: TableControlsProps;
  multiSelect?: MultiSelectDropdownProps;
  className?: string;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  search,
  pagination,
  perPage,
  multiSelect,
  className = ""
}) => {
  return (
    <div className={`table-toolbar ${className}`}>
      <div className="table-toolbar-left">
        {search && <Search {...search} />}
      </div>
      <div className="table-toolbar-right">
        {multiSelect && <MultiSelectDropdown {...multiSelect} />}
        {perPage && <PerPageSelector {...perPage} />}
      </div>
      {pagination && (
        <div className="table-toolbar-pagination">
          <Pagination {...pagination} />
        </div>
      )}
    </div>
  );
}; 