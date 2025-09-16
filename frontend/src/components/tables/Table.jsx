import React from "react";
import LoadingSpinner from "../common/LoadingSpinner";

const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.pages <= 1) return null;

  const { page, pages, total, limit } = pagination;

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (
      let i = Math.max(2, page - delta);
      i <= Math.min(pages - 1, page + delta);
      i++
    ) {
      range.push(i);
    }

    if (page - delta > 2) {
      rangeWithDots.push(1, "...");
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (page + delta < pages - 1) {
      rangeWithDots.push("...", pages);
    } else {
      if (pages > 1) rangeWithDots.push(pages);
    }

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="flex flex-col items-start justify-between p-4 space-y-3 border-t border-gray-200 sm:flex-row sm:items-center sm:space-y-0 bg-gray-50">
      {/* Info */}
      <div className="text-sm text-gray-700">
        Mostrando{" "}
        <span className="font-medium">
          {Math.min((page - 1) * limit + 1, total)}
        </span>{" "}
        a <span className="font-medium">{Math.min(page * limit, total)}</span>{" "}
        de <span className="font-medium">{total}</span> resultados
      </div>

      {/* Navigation */}
      <div className="flex items-center space-x-1">
        {/* Previous */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Anterior
        </button>

        {/* Pages */}
        {visiblePages.map((pageNum, index) => (
          <React.Fragment key={index}>
            {pageNum === "..." ? (
              <span className="px-3 py-2 text-sm font-medium text-gray-700">
                ...
              </span>
            ) : (
              <button
                onClick={() => onPageChange(pageNum)}
                className={`px-3 py-2 text-sm font-medium border ${
                  page === pageNum
                    ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                    : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {pageNum}
              </button>
            )}
          </React.Fragment>
        ))}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

const Table = ({
  columns = [],
  data = [],
  loading = false,
  pagination,
  onPageChange,
  emptyMessage = "No se encontraron datos",
  className = "",
  striped = true,
  hover = true,
  compact = false,
}) => {
  if (loading) {
    return (
      <div className="bg-white border rounded-lg">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white border rounded-lg">
        <div className="py-12 text-center">
          <svg
            className="w-12 h-12 mx-auto text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Sin datos</h3>
          <p className="mt-1 text-sm text-gray-500">{emptyMessage}</p>
        </div>
        {pagination && (
          <Pagination pagination={pagination} onPageChange={onPageChange} />
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          {/* Header */}
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key || index}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    compact ? "px-3 py-2" : "px-6 py-3"
                  }`}
                >
                  {column.title || column.key}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((record, recordIndex) => (
              <tr
                key={record.id || recordIndex}
                className={`
                  ${
                    striped && recordIndex % 2 === 1 ? "bg-gray-50" : "bg-white"
                  }
                  ${hover ? "hover:bg-gray-100" : ""}
                  transition-colors duration-150
                `}
              >
                {columns.map((column, columnIndex) => (
                  <td
                    key={column.key || columnIndex}
                    className={`text-sm text-gray-900 ${
                      compact ? "px-3 py-2" : "px-6 py-4"
                    }`}
                  >
                    {column.render
                      ? column.render(record[column.key], record, recordIndex)
                      : record[column.key] || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <Pagination pagination={pagination} onPageChange={onPageChange} />
      )}
    </div>
  );
};

export default Table;
