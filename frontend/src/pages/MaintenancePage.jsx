import { useState, useEffect } from 'react';
import { Wrench, AlertTriangle, Bell } from 'lucide-react';
import client from '../api/client';
import useUrlFilters from '../hooks/useUrlFilters';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';

const FILTER_DEFAULTS = { filter: '', severity: '' };

export default function MaintenancePage() {
  const [maintenance, setMaintenance] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilter] = useUrlFilters(FILTER_DEFAULTS);

  useEffect(() => {
    async function fetchData() {
      try {
        const [maintenanceRes, alertsRes] = await Promise.all([
          client.get('/maintenance'),
          client.get('/alerts').catch(() => ({ data: [] })),
        ]);
        setMaintenance(maintenanceRes.data.data || maintenanceRes.data || []);
        setAlerts(alertsRes.data.data || alertsRes.data || []);
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load maintenance data.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  function getRowHighlight(item) {
    const scheduledAt = item.scheduled_at ? new Date(item.scheduled_at) : null;
    if (!scheduledAt) return '';

    if (item.status === 'OVERDUE' || (scheduledAt < now && item.status !== 'COMPLETED' && item.status !== 'CANCELLED')) {
      return 'bg-red-50';
    }
    if (scheduledAt < sevenDaysFromNow && item.status !== 'COMPLETED' && item.status !== 'CANCELLED') {
      return 'bg-yellow-50';
    }
    return '';
  }

  const filteredMaintenance = filters.filter === 'overdue'
    ? maintenance.filter((m) => {
        const scheduledAt = m.scheduled_at ? new Date(m.scheduled_at) : null;
        return m.status === 'OVERDUE' || (scheduledAt && scheduledAt < now && m.status !== 'COMPLETED' && m.status !== 'CANCELLED');
      })
    : maintenance;

  const filteredAlerts = filters.severity
    ? alerts.filter((a) => a.severity === filters.severity)
    : alerts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
        <p className="text-sm text-gray-500 mt-1">Schedule and alerts management</p>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

      {/* Maintenance Schedule */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Maintenance Schedule</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('filter', filters.filter === 'overdue' ? '' : 'overdue')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                filters.filter === 'overdue'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              Overdue Only
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Vehicle</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Scheduled At</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Technician</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMaintenance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    No maintenance records found.
                  </td>
                </tr>
              ) : (
                filteredMaintenance.map((m) => {
                  const vehiclePlate = m.license_plate || '-';
                  const highlight = getRowHighlight(m);

                  return (
                    <tr key={m.id} className={`${highlight} hover:bg-opacity-80 transition-colors`}>
                      <td className="px-6 py-4 font-medium text-gray-900">{vehiclePlate}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {m.maintenance_type || m.type || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {m.scheduled_at
                          ? new Date(m.scheduled_at).toLocaleString('th-TH')
                          : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={m.status} type="maintenance" />
                      </td>
                      <td className="px-6 py-4 text-gray-600">{m.technician || '-'}</td>
                      <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                        {m.description || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 px-2 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200" />
            Overdue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-yellow-50 border border-yellow-200" />
            Due within 7 days
          </span>
        </div>
      </div>

      {/* Alerts Panel */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
            {alerts.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                {alerts.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filters.severity}
              onChange={(e) => setFilter('severity', e.target.value)}
              className="input-field w-auto text-xs py-1.5"
            >
              <option value="">All Severities</option>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
              <option value="INFO">Info</option>
            </select>
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No alerts.</p>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert, idx) => (
              <div
                key={alert.id || idx}
                className={`rounded-lg border p-4 ${
                  alert.severity === 'CRITICAL'
                    ? 'border-red-200 bg-red-50'
                    : alert.severity === 'WARNING'
                    ? 'border-yellow-200 bg-yellow-50'
                    : 'border-blue-200 bg-blue-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                      alert.severity === 'CRITICAL'
                        ? 'text-red-500'
                        : alert.severity === 'WARNING'
                        ? 'text-yellow-500'
                        : 'text-blue-500'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={alert.severity} type="alert" />
                      {alert.created_at && (
                        <span className="text-xs text-gray-400">
                          {new Date(alert.created_at).toLocaleString('th-TH')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 font-medium">{alert.message}</p>
                    {(alert.resource_type || alert.resource_id) && (
                      <p className="text-xs text-gray-500 mt-1">
                        Resource: {alert.resource_type}
                        {alert.resource_id ? ` #${alert.resource_id}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
