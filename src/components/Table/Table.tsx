import React, { useState, useMemo } from "react";
import { useKeyPress } from "../../hooks/useKeyPress";
import ScrollableTable from "../Extras/ScrollableTable";
import LoadingSpinner from "../Loading/LoadingSpinner";
import "./Table.scss";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  className?: string;
  renderCell?: (item: T) => React.ReactNode;
  sortable?: boolean;
  sortFn?: (a: T, b: T, direction: "asc" | "desc") => number;
}

export interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  defaultSortKey?: string;
  defaultSortOrder?: "asc" | "desc";
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  className?: string;
  rowClassName?: string | ((item: T) => string);
  isSelectedRow?: (item: T) => boolean;
  pagination?: {
    page: number;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    inputPage: string;
    setInputPage: React.Dispatch<React.SetStateAction<string>>;
    itemsPerPage: number;
    totalItems?: number;
  };
}

interface TableHeaderProps {
  column: Column<any>;
  onClick: () => void;
  isSorted: boolean;
  sortOrder: "asc" | "desc";
}

const TableHeader: React.FC<TableHeaderProps> = ({ 
  column, 
  onClick, 
  isSorted, 
  sortOrder 
}) => (
  <th 
    onClick={column.sortable !== false ? onClick : undefined} 
    className={`${column.className || ""} ${column.sortable !== false ? "sortable" : ""}`}
    style={{ width: column.width }}
  >
    <div className="header-content">
      <span className="header-text">{column.header}</span>
      {isSorted && column.sortable !== false && (
        <span className="sort-arrow">{sortOrder === "asc" ? "▲" : "▼"}</span>
      )}
    </div>
  </th>
);

function Table<T>({
  data,
  columns,
  keyExtractor,
  defaultSortKey = columns[0]?.key,
  defaultSortOrder = "desc",
  loading = false,
  loadingMessage = "Loading...",
  emptyMessage = "No data found",
  onRowClick,
  className = "",
  rowClassName = "",
  isSelectedRow,
  pagination
}: TableProps<T>) {
  const [sortBy, setSortBy] = useState<string>(defaultSortKey);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(defaultSortOrder);
  const [secondarySortBy, setSecondarySortBy] = useState<string | null>(null);
  const [secondarySortOrder, setSecondarySortOrder] = useState<"asc" | "desc">("desc");
  
  const shiftPressed = useKeyPress("Shift");

  const handleSort = (columnKey: string) => {
    if (!shiftPressed) {
      setSecondarySortBy(null);
      setSecondarySortOrder("desc");
      if (sortBy === columnKey) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortBy(columnKey);
        setSortOrder("desc");
      }
    } else {
      if (secondarySortBy === columnKey) {
        setSecondarySortOrder(secondarySortOrder === "asc" ? "desc" : "asc");
      } else {
        setSecondarySortBy(columnKey);
        setSecondarySortOrder("desc");
      }
    }
  };

  const sortedData = useMemo(() => {
    if (!data) return [];

    const getValueByKey = (item: T, key: string): any => {
      const keys = key.split(".");
      return keys.reduce(
        (obj, key) => (obj && typeof obj === "object" ? obj[key as keyof typeof obj] : undefined),
        item as any
      );
    };

    return [...data].sort((a, b) => {
      const primaryColumn = columns.find(col => col.key === sortBy);
      
      if (primaryColumn?.sortFn) {
        return primaryColumn.sortFn(a, b, sortOrder);
      }

      let aValue = getValueByKey(a, sortBy);
      let bValue = getValueByKey(b, sortBy);
      
      if (typeof aValue === "string") aValue = aValue.toLowerCase();
      if (typeof bValue === "string") bValue = bValue.toLowerCase();
      
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortOrder === "asc" ? -1 : 1;
      if (bValue == null) return sortOrder === "asc" ? 1 : -1;

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      
      if (secondarySortBy) {
        const secondaryColumn = columns.find(col => col.key === secondarySortBy);
        
        if (secondaryColumn?.sortFn) {
          return secondaryColumn.sortFn(a, b, secondarySortOrder);
        }
        
        let aSecondaryValue = getValueByKey(a, secondarySortBy);
        let bSecondaryValue = getValueByKey(b, secondarySortBy);
        
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
  }, [data, columns, sortBy, sortOrder, secondarySortBy, secondarySortOrder]);

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    
    const startIndex = (pagination.page - 1) * pagination.itemsPerPage;
    return sortedData.slice(startIndex, startIndex + pagination.itemsPerPage);
  }, [sortedData, pagination?.page, pagination?.itemsPerPage]);

  const getRowClassName = (item: T): string => {
    let classes = [];
    
    if (typeof rowClassName === "function") {
      classes.push(rowClassName(item));
    } else if (rowClassName) {
      classes.push(rowClassName);
    }
    
    if (isSelectedRow && isSelectedRow(item)) {
      classes.push("selected-row");
    }
    
    return classes.filter(Boolean).join(" ");
  };

  return (
    <ScrollableTable className={className}>
      {loading ? (
        <LoadingSpinner message={loadingMessage} />
      ) : (
        <table>
          <thead>
            <tr>
              {columns.map(column => (
                <TableHeader
                  key={column.key}
                  column={column}
                  onClick={() => handleSort(column.key)}
                  isSorted={sortBy === column.key || secondarySortBy === column.key}
                  sortOrder={sortBy === column.key ? sortOrder : secondarySortOrder}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="empty-message">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map(item => (
                <tr 
                  key={keyExtractor(item)} 
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={getRowClassName(item)}
                >
                  {columns.map(column => (
                    <td 
                      key={`${keyExtractor(item)}-${column.key}`} 
                      className={column.className}
                    >
                      {column.renderCell 
                        ? column.renderCell(item)
                        : getValueByKey(item, column.key)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </ScrollableTable>
  );
}

export default Table;

function getValueByKey<T>(obj: T, key: string): any {
  const keys = key.split(".");
  return keys.reduce(
    (result, key) => (result && typeof result === "object" ? result[key as keyof typeof result] : undefined),
    obj as any
  );
} 