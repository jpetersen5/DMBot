import { useState, useMemo } from "react";

export interface UseTableDataOptions<T> {
  data: T[];
  defaultSortKey?: string;
  defaultSortOrder?: "asc" | "desc";
  defaultFilters?: string[];
  defaultSearch?: string;
  defaultPage?: number;
  defaultPerPage?: number;
  getFilterableFields?: (item: T) => Record<string, string | number | boolean | null | undefined>;
}

export interface UseTableDataReturn<T> {
  page: number;
  setPage: (page: number) => void;
  inputPage: string;
  setInputPage: (inputPage: string) => void;
  perPage: number;
  setPerPage: (perPage: number) => void;
  sortBy: string;
  setSortBy: (sortBy: string) => void;
  sortOrder: "asc" | "desc";
  setSortOrder: (sortOrder: "asc" | "desc") => void;
  secondarySortBy: string | null;
  setSecondarySortBy: (secondarySortBy: string | null) => void;
  secondarySortOrder: "asc" | "desc";
  setSecondarySortOrder: (secondarySortOrder: "asc" | "desc") => void;
  search: string;
  setSearch: (search: string) => void;
  filters: string[];
  setFilters: (filters: string[]) => void;
  totalPages: number;
  filteredData: T[];
  paginatedData: T[];
  handleSort: (column: string, withShift?: boolean) => void;
}

/**
 * Hook for managing table data with pagination, sorting, and filtering
 */
export function useTableData<T>({
  data,
  defaultSortKey = "",
  defaultSortOrder = "desc",
  defaultFilters = [],
  defaultSearch = "",
  defaultPage = 1,
  defaultPerPage = 50,
  getFilterableFields
}: UseTableDataOptions<T>): UseTableDataReturn<T> {
  const [page, setPage] = useState<number>(defaultPage);
  const [inputPage, setInputPage] = useState<string>(defaultPage.toString());
  const [perPage, setPerPage] = useState<number>(defaultPerPage);

  const [sortBy, setSortBy] = useState<string>(defaultSortKey);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(defaultSortOrder);
  const [secondarySortBy, setSecondarySortBy] = useState<string | null>(null);
  const [secondarySortOrder, setSecondarySortOrder] = useState<"asc" | "desc">("desc");

  const [search, setSearch] = useState<string>(defaultSearch);
  const [filters, setFilters] = useState<string[]>(defaultFilters);

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
    setInputPage("1");
  };

  const handleFiltersChange = (newFilters: string[]) => {
    setFilters(newFilters);
    setPage(1);
    setInputPage("1");
  };

  const handleSort = (column: string, withShift = false) => {
    if (!withShift) {
      setSecondarySortBy(null);
      setSecondarySortOrder("desc");
      if (sortBy === column) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortBy(column);
        setSortOrder("desc");
      }
    } else {
      if (secondarySortBy === column) {
        setSecondarySortOrder(secondarySortOrder === "asc" ? "desc" : "asc");
      } else {
        setSecondarySortBy(column);
        setSecondarySortOrder("desc");
      }
    }
  };

  const getValueByPath = (obj: any, path: string): any => {
    if (!obj || !path) return undefined;
    
    const keys = path.split(".");
    return keys.reduce(
      (value, key) => (value && typeof value === "object" ? value[key] : undefined),
      obj
    );
  };

  // Filter data
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    let filtered = [...data];

    if (search) {
      const searchTermsLower = search.toLowerCase().split(" ");
      
      filtered = filtered.filter(item => {
        if (getFilterableFields) {
          const fields = getFilterableFields(item);
          
          if (filters.length === 0) {
            return searchTermsLower.every(term => 
              Object.values(fields).some(value => 
                value != null && value.toString().toLowerCase().includes(term)
              )
            );
          } else {
            return searchTermsLower.every(term => 
              filters.some(field => {
                const value = fields[field];
                return value != null && value.toString().toLowerCase().includes(term);
              })
            );
          }
        } else {
          if (filters.length === 0) {
            return searchTermsLower.every(term => 
              Object.entries(item as any).some(([_, value]) => 
                value != null && value.toString().toLowerCase().includes(term)
              )
            );
          } else {
            return searchTermsLower.every(term => 
              filters.some(field => {
                const value = getValueByPath(item, field);
                return value != null && value.toString().toLowerCase().includes(term);
              })
            );
          }
        }
      });
    }

    // Sort data
    if (sortBy) {
      filtered.sort((a, b) => {
        let aValue = getValueByPath(a, sortBy);
        let bValue = getValueByPath(b, sortBy);
        
        if (typeof aValue === "string") aValue = aValue.toLowerCase();
        if (typeof bValue === "string") bValue = bValue.toLowerCase();
        
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return sortOrder === "asc" ? -1 : 1;
        if (bValue == null) return sortOrder === "asc" ? 1 : -1;
        
        if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
        
        if (secondarySortBy) {
          let aSecondaryValue = getValueByPath(a, secondarySortBy);
          let bSecondaryValue = getValueByPath(b, secondarySortBy);
          
          if (typeof aSecondaryValue === "string") aSecondaryValue = aSecondaryValue.toLowerCase();
          if (typeof bSecondaryValue === "string") bSecondaryValue = bSecondaryValue.toLowerCase();
          
          if (aSecondaryValue == null && bSecondaryValue == null) return 0;
          if (aSecondaryValue == null) return secondarySortOrder === "asc" ? -1 : 1;
          if (bSecondaryValue == null) return secondarySortOrder === "asc" ? 1 : -1;
          
          if (aSecondaryValue < bSecondaryValue) return secondarySortOrder === "asc" ? -1 : 1;
          if (aSecondaryValue > bSecondaryValue) return secondarySortOrder === "asc" ? 1 : -1;
        }
        
        return 0;
      });
    }

    return filtered;
  }, [data, search, filters, sortBy, sortOrder, secondarySortBy, secondarySortOrder, getFilterableFields]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    return filteredData.slice(startIndex, startIndex + perPage);
  }, [filteredData, page, perPage]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / perPage));

  useMemo(() => {
    if (page > totalPages) {
      setPage(totalPages);
      setInputPage(totalPages.toString());
    }
  }, [totalPages, page]);

  return {
    page,
    setPage,
    inputPage,
    setInputPage,
    perPage,
    setPerPage,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    secondarySortBy,
    setSecondarySortBy,
    secondarySortOrder,
    setSecondarySortOrder,
    search,
    setSearch: handleSearchChange,
    filters,
    setFilters: handleFiltersChange,
    totalPages,
    filteredData,
    paginatedData,
    handleSort
  };
} 