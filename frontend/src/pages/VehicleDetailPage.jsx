import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Truck, Route, Wrench, Calendar } from 'lucide-react';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';

export default function VehicleDetailPage() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [vehicleRes, historyRes] = await Promise.all([
          client.get(`/vehicles/${id}`),
          client.get(`/vehicles/${id}/history`).catch(() => ({ data: [] })),
        ]);
        setVehicle(vehicleRes.data.data || vehicleRes.data);
        const hist = historyRes.data.data || historyRes.data || [];
        // Sort history by date descending
        hist.sort((a, b) => new Date(b.event_date || b.created_at) - new Date(a.event_date || a.created_at));
        setHistory(hist);
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load vehicle details.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  if (!vehicle) return <ErrorAlert message="Vehicle not found." />;

  const driverName = vehicle.driver_name || 'Unassigned';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/vehicles" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{vehicle.license_plate}</h1>
          <p className="text-sm text-gray-500">
            {vehicle.brand} {vehicle.model} - {vehicle.type}
          </p>
        </div>
        <StatusBadge status={vehicle.status} type="vehicle" className="ml-auto text-sm" />
      </div>

      {/* Vehicle Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Vehicle Info</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">License Plate</dt>
              <dd className="font-medium">{vehicle.license_plate}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Type</dt>
              <dd className="font-medium">{vehicle.type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Brand</dt>
              <dd className="font-medium">{vehicle.brand}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Model</dt>
              <dd className="font-medium">{vehicle.model}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Year</dt>
              <dd className="font-medium">{vehicle.year || '-'}</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Status & Mileage</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd><StatusBadge status={vehicle.status} type="vehicle" /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Mileage</dt>
              <dd className="font-medium">
                {(vehicle.mileage_km ?? vehicle.mileage ?? 0).toLocaleString()} km
              </dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Assigned Driver</h3>
          <p className="text-lg font-semibold text-gray-900">{driverName}</p>
          {vehicle.driver_id && (
            <p className="text-sm text-gray-500 mt-2">Driver ID: {vehicle.driver_id}</p>
          )}
        </div>
      </div>

      {/* History Timeline */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Vehicle History</h2>
        {history.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No history records found.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-6">
              {history.map((item, idx) => {
                const isTrip = item.type === 'trip' || item.origin;
                const isMaintenance = item.type === 'maintenance' || item.maintenance_type;
                const itemDate = item.event_date || item.created_at || item.scheduled_at;

                return (
                  <div key={idx} className="relative flex items-start gap-4 pl-12">
                    <div
                      className={`absolute left-4 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${
                        isTrip ? 'bg-blue-500' : isMaintenance ? 'bg-orange-500' : 'bg-gray-400'
                      }`}
                    >
                      {isTrip ? (
                        <Route className="h-3 w-3 text-white" />
                      ) : isMaintenance ? (
                        <Wrench className="h-3 w-3 text-white" />
                      ) : (
                        <Calendar className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge
                          status={isTrip ? 'TRIP' : isMaintenance ? 'MAINTENANCE' : 'EVENT'}
                          type="default"
                        />
                        <span className="text-xs text-gray-400">
                          {itemDate ? new Date(itemDate).toLocaleString('th-TH') : '-'}
                        </span>
                      </div>
                      {isTrip ? (
                        <div className="text-sm text-gray-700">
                          <p className="font-medium">
                            {item.origin} → {item.destination}
                          </p>
                          <p className="text-gray-500">
                            Distance: {item.distance_km} km | Status: {item.status}
                          </p>
                          {item.id && (
                            <Link to={`/trips/${item.id}`} className="text-blue-600 hover:underline text-xs mt-1 inline-block">
                              View trip details
                            </Link>
                          )}
                        </div>
                      ) : isMaintenance ? (
                        <div className="text-sm text-gray-700">
                          <p className="font-medium">
                            {item.maintenance_type || item.description || 'Maintenance'}
                          </p>
                          <p className="text-gray-500">
                            Status: {item.status}
                            {item.technician && ` | Technician: ${item.technician}`}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700">{item.description || 'Event recorded'}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
