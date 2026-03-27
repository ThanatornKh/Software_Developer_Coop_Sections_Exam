import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Package, Truck, User, CheckCircle, Clock, XCircle, ArrowRight } from 'lucide-react';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';

const CHECKPOINT_COLORS = {
  PENDING: { bg: 'bg-gray-200', text: 'text-gray-500', ring: 'ring-gray-300' },
  ARRIVED: { bg: 'bg-blue-500', text: 'text-white', ring: 'ring-blue-300' },
  DEPARTED: { bg: 'bg-green-500', text: 'text-white', ring: 'ring-green-300' },
  SKIPPED: { bg: 'bg-red-500', text: 'text-white', ring: 'ring-red-300' },
};

export default function TripDetailPage() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [updatingCheckpoint, setUpdatingCheckpoint] = useState(null);

  const fetchTrip = useCallback(async () => {
    try {
      const res = await client.get(`/trips/${id}`);
      const tripData = res.data.data || res.data;
      setTrip(tripData);

      // Checkpoints may be nested in trip or fetched separately
      let cps = tripData.checkpoints || [];
      if (cps.length === 0) {
        try {
          const cpRes = await client.get(`/trips/${id}/checkpoints`);
          cps = cpRes.data.data || cpRes.data || [];
        } catch {
          // Checkpoints might not have a separate endpoint
        }
      }
      cps.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      setCheckpoints(cps);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load trip details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  const handleCheckpointUpdate = async (checkpointId, newStatus) => {
    setActionError('');
    setUpdatingCheckpoint(checkpointId);

    // Optimistic update - save previous state
    const prevCheckpoints = [...checkpoints];
    setCheckpoints((prev) =>
      prev.map((cp) => (cp.id === checkpointId ? { ...cp, status: newStatus } : cp))
    );

    // Simulate API delay 300-800ms
    const delay = 300 + Math.random() * 500;

    try {
      await new Promise((resolve) => setTimeout(resolve, delay));

      // 30% chance of failure
      if (Math.random() < 0.3) {
        throw new Error('simulated');
      }

      // Actually call the API
      await client.patch(`/checkpoints/${checkpointId}/status`, {
        status: newStatus,
      });
    } catch (err) {
      // Rollback on failure
      setCheckpoints(prevCheckpoints);
      if (err.message === 'simulated') {
        setActionError(
          `Failed to update checkpoint status to ${newStatus}. The server did not respond. Please try again in a moment.`
        );
      } else {
        setActionError(
          err.response?.data?.error?.message || 'Failed to update checkpoint. Please try again.'
        );
      }
    } finally {
      setUpdatingCheckpoint(null);
    }
  };

  const handleTripStatusUpdate = async (newStatus) => {
    setActionError('');
    try {
      const actionMap = {
        IN_PROGRESS: 'start',
        COMPLETED: 'complete',
        CANCELLED: 'cancel',
      };
      const action = actionMap[newStatus];
      const res = await client.patch(`/trips/${id}/${action}`);
      setTrip((prev) => ({ ...prev, ...(res.data.data || {}), status: newStatus }));
    } catch (err) {
      setActionError(err.response?.data?.error?.message || 'Failed to update trip status.');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  if (!trip) return <ErrorAlert message="Trip not found." />;

  const vehiclePlate = trip.license_plate || '-';
  const driverName = trip.driver_name || '-';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/trips" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trip #{trip.id}</h1>
          <p className="text-sm text-gray-500">
            {trip.origin} → {trip.destination}
          </p>
        </div>
        <StatusBadge status={trip.status} type="trip" className="ml-auto text-sm" />
      </div>

      {actionError && <ErrorAlert message={actionError} onDismiss={() => setActionError('')} />}

      {/* Trip Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-500">Vehicle</h3>
          </div>
          <p className="text-lg font-semibold text-gray-900">{vehiclePlate}</p>
          {trip.vehicle_id && (
            <p className="text-sm text-gray-500">
              Vehicle ID: {trip.vehicle_id}
            </p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-500">Driver</h3>
          </div>
          <p className="text-lg font-semibold text-gray-900">{driverName}</p>
          {trip.driver_id && (
            <p className="text-sm text-gray-500">ID: {trip.driver_id}</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-500">Cargo</h3>
          </div>
          <p className="text-lg font-semibold text-gray-900">
            {trip.cargo_type || 'Not specified'}
          </p>
          <p className="text-sm text-gray-500">
            {trip.cargo_weight_kg ? `${trip.cargo_weight_kg} kg` : '-'} | {trip.distance_km} km
          </p>
        </div>
      </div>

      {/* Trip Action Buttons */}
      <div className="flex items-center gap-3">
        {trip.status === 'SCHEDULED' && (
          <button
            onClick={() => handleTripStatusUpdate('IN_PROGRESS')}
            className="btn-primary"
          >
            Start Trip
          </button>
        )}
        {trip.status === 'IN_PROGRESS' && (
          <button
            onClick={() => handleTripStatusUpdate('COMPLETED')}
            className="btn-primary bg-green-600 hover:bg-green-700"
          >
            Complete Trip
          </button>
        )}
        {(trip.status === 'SCHEDULED' || trip.status === 'IN_PROGRESS') && (
          <button
            onClick={() => handleTripStatusUpdate('CANCELLED')}
            className="btn-danger"
          >
            Cancel Trip
          </button>
        )}
      </div>

      {/* Checkpoint Progress Tracker */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Checkpoint Progress</h2>

        {checkpoints.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No checkpoints for this trip.</p>
        ) : (
          <div className="space-y-0">
            {checkpoints.map((cp, idx) => {
              const colors = CHECKPOINT_COLORS[cp.status] || CHECKPOINT_COLORS.PENDING;
              const isLast = idx === checkpoints.length - 1;
              const isUpdating = updatingCheckpoint === cp.id;

              return (
                <div key={cp.id || idx} className="relative flex gap-4">
                  {/* Connector line and dot */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full ${colors.bg} ${colors.text} ring-4 ${colors.ring} flex items-center justify-center flex-shrink-0 z-10 ${
                        isUpdating ? 'animate-pulse' : ''
                      }`}
                    >
                      {cp.status === 'DEPARTED' ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : cp.status === 'ARRIVED' ? (
                        <MapPin className="h-5 w-5" />
                      ) : cp.status === 'SKIPPED' ? (
                        <XCircle className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className={`w-0.5 h-full min-h-[3rem] ${
                          cp.status === 'DEPARTED' ? 'bg-green-300' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>

                  {/* Checkpoint content */}
                  <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">
                              {cp.location_name || `Checkpoint ${idx + 1}`}
                            </h4>
                            <StatusBadge status={cp.status} type="checkpoint" />
                          </div>
                          {cp.purpose && (
                            <p className="text-sm text-gray-500 mt-1">Purpose: {cp.purpose}</p>
                          )}
                          {cp.notes && (
                            <p className="text-sm text-gray-400 mt-0.5">{cp.notes}</p>
                          )}
                          {(cp.latitude || cp.longitude) && (
                            <p className="text-xs text-gray-400 mt-1 font-mono">
                              {cp.latitude}, {cp.longitude}
                            </p>
                          )}
                        </div>

                        {/* Action buttons - only show when previous checkpoint is DEPARTED/SKIPPED */}
                        {trip.status === 'IN_PROGRESS' && (() => {
                          const prevCp = idx > 0 ? checkpoints[idx - 1] : null;
                          const prevDone = !prevCp || prevCp.status === 'DEPARTED' || prevCp.status === 'SKIPPED';
                          return (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {cp.status === 'PENDING' && prevDone && (
                                <button
                                  onClick={() => handleCheckpointUpdate(cp.id, 'ARRIVED')}
                                  disabled={isUpdating}
                                  className="text-xs px-2.5 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors disabled:opacity-50"
                                >
                                  Mark Arrived
                                </button>
                              )}
                              {cp.status === 'PENDING' && prevDone && (
                                <button
                                  onClick={() => handleCheckpointUpdate(cp.id, 'SKIPPED')}
                                  disabled={isUpdating}
                                  className="text-xs px-2.5 py-1.5 rounded bg-gray-50 text-gray-600 hover:bg-gray-100 font-medium transition-colors disabled:opacity-50"
                                >
                                  Skip
                                </button>
                              )}
                              {cp.status === 'ARRIVED' && (
                                <button
                                  onClick={() => handleCheckpointUpdate(cp.id, 'DEPARTED')}
                                  disabled={isUpdating}
                                  className="text-xs px-2.5 py-1.5 rounded bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors disabled:opacity-50"
                                >
                                  Mark Departed
                                </button>
                              )}
                              {cp.status === 'PENDING' && !prevDone && (
                                <span className="text-xs text-gray-400 italic">
                                  รอ checkpoint ก่อนหน้า
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
