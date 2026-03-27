import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ChevronRight } from 'lucide-react';
import client from '../api/client';
import useUrlFilters from '../hooks/useUrlFilters';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import Pagination from '../components/Pagination';

const FILTER_DEFAULTS = { status: '', page: '1' };
const TRIP_STATUSES = ['', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function TripListPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilter, resetFilters] = useUrlFilters(FILTER_DEFAULTS);

  useEffect(() => {
    async function fetchTrips() {
      try {
        const params = {};
        if (filters.status) params.status = filters.status;
        const res = await client.get('/trips', { params });
        setTrips(res.data.data || res.data || []);
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load trips.');
      } finally {
        setLoading(false);
      }
    }
    fetchTrips();
  }, [filters.status]);

  const pageSize = 10;
  const currentPage = parseInt(filters.page) || 1;
  const totalPages = Math.ceil(trips.length / pageSize);
  const paginatedTrips = trips.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trips</h1>
          <p className="text-sm text-gray-500 mt-1">{trips.length} trip{trips.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/trips/create" className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          New Trip
        </Link>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filters.status}
          onChange={(e) => { setFilter('status', e.target.value); setFilter('page', '1'); }}
          className="input-field w-auto"
        >
          <option value="">All Statuses</option>
          {TRIP_STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        {filters.status && (
          <button onClick={resetFilters} className="text-sm text-blue-600 hover:text-blue-800">
            Clear filter
          </button>
        )}
      </div>

      {/* Trip Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Trip #</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Vehicle</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Driver</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Route</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedTrips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No trips found.
                  </td>
                </tr>
              ) : (
                paginatedTrips.map((trip) => {
                  const vehiclePlate = trip.license_plate || '-';
                  const driverName = trip.driver_name || '-';
                  const tripDate = trip.started_at || trip.created_at;

                  return (
                    <tr key={trip.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          to={`/trips/${trip.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          #{trip.id}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{vehiclePlate}</td>
                      <td className="px-6 py-4 text-gray-600">{driverName}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {trip.origin} → {trip.destination}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={trip.status} type="trip" />
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {tripDate ? new Date(tripDate).toLocaleString('th-TH') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/trips/${trip.id}`}
                          className="text-gray-400 hover:text-blue-600"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        onPageChange={(p) => setFilter('page', String(p))}
      />
    </div>
  );
}
