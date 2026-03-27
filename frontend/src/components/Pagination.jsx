import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, onPageChange, className = '' }) {
  if (!totalPages || totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <p className="text-sm text-gray-600">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-secondary py-1.5 px-3 text-sm"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-secondary py-1.5 px-3 text-sm"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </button>
      </div>
    </div>
  );
}
