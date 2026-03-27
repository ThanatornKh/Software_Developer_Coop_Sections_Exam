import { useState, useEffect } from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';

export default function DriverListPage() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDrivers() {
      try {
        const res = await client.get('/drivers');
        setDrivers(res.data.data || res.data || []);
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load drivers.');
      } finally {
        setLoading(false);
      }
    }
    fetchDrivers();
  }, []);

  if (loading) return <LoadingSpinner />;

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  function getLicenseStatus(expiresAt) {
    if (!expiresAt) return 'unknown';
    const expDate = new Date(expiresAt);
    if (expDate < now) return 'expired';
    if (expDate < sevenDaysFromNow) return 'expiring';
    return 'valid';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
        <p className="text-sm text-gray-500 mt-1">{drivers.length} driver{drivers.length !== 1 ? 's' : ''}</p>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">License Number</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">License Expires</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Phone</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    No drivers found.
                  </td>
                </tr>
              ) : (
                drivers.map((driver) => {
                  const licenseStatus = getLicenseStatus(driver.license_expires_at);

                  return (
                    <tr key={driver.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 h-9 w-9 bg-blue-100 rounded-full flex items-center justify-center">
                            <Users className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-900">
                            {driver.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                        {driver.license_number || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm ${
                              licenseStatus === 'expired'
                                ? 'text-red-600 font-semibold'
                                : licenseStatus === 'expiring'
                                ? 'text-yellow-600 font-semibold'
                                : 'text-gray-600'
                            }`}
                          >
                            {driver.license_expires_at
                              ? new Date(driver.license_expires_at).toLocaleDateString('th-TH')
                              : '-'}
                          </span>
                          {licenseStatus === 'expired' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              <AlertTriangle className="h-3 w-3" />
                              Expired
                            </span>
                          )}
                          {licenseStatus === 'expiring' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                              <AlertTriangle className="h-3 w-3" />
                              Expiring Soon
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{driver.phone || '-'}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={driver.status} type="driver" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
