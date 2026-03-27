import { useNavigate } from 'react-router-dom';

export default function MetricCard({ icon: Icon, label, value, trend, to, className = '' }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) navigate(to);
  };

  return (
    <div
      onClick={handleClick}
      className={`card ${to ? 'cursor-pointer hover:shadow-md hover:border-blue-200 transition-all' : ''} ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value ?? '-'}</p>
          {trend !== undefined && trend !== null && (
            <p
              className={`mt-1 text-sm font-medium ${
                trend >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend >= 0 ? '+' : ''}
              {trend}% from yesterday
            </p>
          )}
        </div>
        {Icon && (
          <div className="flex-shrink-0 ml-4 p-3 bg-blue-50 rounded-xl">
            <Icon className="h-7 w-7 text-blue-600" />
          </div>
        )}
      </div>
    </div>
  );
}
