const statusColors = {
  vehicle: {
    ACTIVE: 'bg-green-100 text-green-800',
    IDLE: 'bg-gray-100 text-gray-800',
    MAINTENANCE: 'bg-orange-100 text-orange-800',
    RETIRED: 'bg-red-100 text-red-800',
  },
  trip: {
    SCHEDULED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  },
  checkpoint: {
    PENDING: 'bg-gray-100 text-gray-600',
    ARRIVED: 'bg-blue-100 text-blue-800',
    DEPARTED: 'bg-green-100 text-green-800',
    SKIPPED: 'bg-red-100 text-red-800',
  },
  maintenance: {
    SCHEDULED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    OVERDUE: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-600',
  },
  alert: {
    WARNING: 'bg-yellow-100 text-yellow-800',
    CRITICAL: 'bg-red-100 text-red-800',
    INFO: 'bg-blue-100 text-blue-800',
  },
  driver: {
    ACTIVE: 'bg-green-100 text-green-800',
    INACTIVE: 'bg-gray-100 text-gray-600',
    ON_LEAVE: 'bg-yellow-100 text-yellow-800',
  },
  default: {
    ACTIVE: 'bg-green-100 text-green-800',
    INACTIVE: 'bg-gray-100 text-gray-600',
    PENDING: 'bg-yellow-100 text-yellow-800',
    SUCCESS: 'bg-green-100 text-green-800',
    FAILURE: 'bg-red-100 text-red-800',
    ERROR: 'bg-red-100 text-red-800',
  },
};

export default function StatusBadge({ status, type = 'default', className = '' }) {
  if (!status) return null;

  const colorMap = statusColors[type] || statusColors.default;
  const colorClass = colorMap[status] || 'bg-gray-100 text-gray-800';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass} ${className}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
