import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, ChevronRight } from 'lucide-react';
import client from '../api/client';
import useUrlFilters from '../hooks/useUrlFilters';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import Pagination from '../components/Pagination';

const STATUSES = ['', 'ACTIVE', 'IDLE', 'MAINTENANCE', 'RETIRED'];
const TYPES = ['', 'TRUCK', 'VAN', 'MOTORCYCLE', 'PICKUP'];

const VALID_TRANSITIONS = {
  IDLE: ['ACTIVE'],
  ACTIVE: ['IDLE', 'MAINTENANCE'],
  MAINTENANCE: ['IDLE'],
  RETIRED: [],
};

const FILTER_DEFAULTS = { status: '', type: '', driver: '', search: '', page: '1' };

export default function VehicleListPage() {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transitionError, setTransitionError] = useState('');
  const [filters, setFilter, resetFilters] = useUrlFilters(FILTER_DEFAULTS);

  const fetchData = useCallback(async () => {
    try {
      const [vehiclesRes, driversRes] = await Promise.all([
        client.get('/vehicles'),
        client.get('/drivers'),
      ]);
      setVehicles(vehiclesRes.data.data || vehiclesRes.data || []);
      setDrivers(driversRes.data.data || driversRes.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load vehicles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredVehicles = useMemo(() => {
    let result = vehicles;

    if (filters.status) {
      result = result.filter((v) => v.status === filters.status);
    }
    if (filters.type) {
      result = result.filter((v) => v.type === filters.type);
    }
    if (filters.driver) {
      result = result.filter((v) => {
        const driverId = v.driver_id || v.driver?.id;
        return driverId && String(driverId) === filters.driver;
      });
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (v) =>
          (v.license_plate || '').toLowerCase().includes(q) ||
          (v.brand || '').toLowerCase().includes(q) ||
          (v.model || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [vehicles, filters]);

  const pageSize = 10;
  const currentPage = parseInt(filters.page) || 1;
  const totalPages = Math.ceil(filteredVehicles.length / pageSize);
  const paginatedVehicles = filteredVehicles.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleStatusTransition = async (vehicle, newStatus) => {
    setTransitionError('');
    const valid = VALID_TRANSITIONS[vehicle.status] || [];
    if (!valid.includes(newStatus)) {
      setTransitionError(
        `Invalid transition for ${vehicle.license_plate}: ${vehicle.status} can only transition to ${valid.length ? valid.join(', ') : 'no other status'}.`
      );
      return;
    }

    try {
      await client.patch(`/vehicles/${vehicle.id}`, { status: newStatus });
      setVehicles((prev) =>
        prev.map((v) => (v.id === vehicle.id ? { ...v, status: newStatus } : v))
      );
    } catch (err) {
      setTransitionError(
        err.response?.data?.message || `Failed to update status for ${vehicle.license_plate}.`
      );
    }
  };

  const getTransitionButtons = (vehicle) => {
    const valid = VALID_TRANSITIONS[vehicle.status] || [];
    return valid.map((status) => (
      <button
        key={status}
        onClick={(e) => {
          e.preventDefault();
          handleStatusTransition(vehicle, status);
        }}
        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
      >
        {status}
      </button>
    ));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredVehicles.length} vehicle{filteredVehicles.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}
      {transitionError && (
        <ErrorAlert message={transitionError} onDismiss={() => setTransitionError('')} />
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {(filters.status || filters.type || filters.driver || filters.search) && (
            <button
              onClick={resetFilters}
              className="text-xs text-blue-600 hover:text-blue-800 ml-auto"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={filters.status}
            onChange={(e) => { setFilter('status', e.target.value); setFilter('page', '1'); }}
            className="input-field"
          >
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={filters.type}
            onChange={(e) => { setFilter('type', e.target.value); setFilter('page', '1'); }}
            className="input-field"
          >
            <option value="">All Types</option>
            {TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={filters.driver}
            onChange={(e) => { setFilter('driver', e.target.value); setFilter('page', '1'); }}
            className="input-field"
          >
            <option value="">All Drivers</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => { setFilter('search', e.target.value); setFilter('page', '1'); }}
              placeholder="Search plate, brand, model..."
              className="input-field pl-9"
            />
          </div>
        </div>
      </div>

      {/* Vehicle Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">License Plate</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Brand / Model</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Driver</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Mileage (km)</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedVehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No vehicles found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedVehicles.map((v) => {
                  const driverName = v.driver_name || '-';

                  return (
                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          to={`/vehicles/${v.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {v.license_plate}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{v.type}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {v.brand} {v.model}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={v.status} type="vehicle" />
                      </td>
                      <td className="px-6 py-4 text-gray-600">{driverName}</td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {(v.mileage_km ?? v.mileage ?? 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {getTransitionButtons(v)}
                          <Link
                            to={`/vehicles/${v.id}`}
                            className="text-gray-400 hover:text-blue-600 ml-1"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
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
