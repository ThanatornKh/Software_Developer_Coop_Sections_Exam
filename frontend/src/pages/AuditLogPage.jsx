import { useState, useEffect } from 'react';
import { ClipboardList, Filter } from 'lucide-react';
import client from '../api/client';
import useUrlFilters from '../hooks/useUrlFilters';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import Pagination from '../components/Pagination';

const FILTER_DEFAULTS = { action: '', resource_type: '', date_from: '', date_to: '', page: '1' };

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilter, resetFilters] = useUrlFilters(FILTER_DEFAULTS);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const params = {};
        if (filters.action) params.action = filters.action;
        if (filters.resource_type) params.resource_type = filters.resource_type;
        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;

        const res = await client.get('/audit-logs', { params });
        setLogs(res.data.data || res.data || []);
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load audit logs.');
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [filters.action, filters.resource_type, filters.date_from, filters.date_to]);

  const pageSize = 15;
  const currentPage = parseInt(filters.page) || 1;
  const totalPages = Math.ceil(logs.length / pageSize);
  const paginatedLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Extract unique values for filter dropdowns
  const uniqueActions = [...new Set(logs.map((l) => l.action).filter(Boolean))];
  const uniqueResourceTypes = [...new Set(logs.map((l) => l.resource_type).filter(Boolean))];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          System activity and change history ({logs.length} records)
        </p>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {(filters.action || filters.resource_type || filters.date_from || filters.date_to) && (
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
            value={filters.action}
            onChange={(e) => { setFilter('action', e.target.value); setFilter('page', '1'); }}
            className="input-field"
          >
            <option value="">All Actions</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <select
            value={filters.resource_type}
            onChange={(e) => { setFilter('resource_type', e.target.value); setFilter('page', '1'); }}
            className="input-field"
          >
            <option value="">All Resource Types</option>
            {uniqueResourceTypes.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <div>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => { setFilter('date_from', e.target.value); setFilter('page', '1'); }}
              className="input-field"
              placeholder="From date"
            />
          </div>

          <div>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => { setFilter('date_to', e.target.value); setFilter('page', '1'); }}
              className="input-field"
              placeholder="To date"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Timestamp</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">User</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Action</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Resource Type</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Resource ID</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    No audit log entries found.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-500 text-xs whitespace-nowrap">
                      {log.created_at || log.timestamp
                        ? new Date(log.created_at || log.timestamp).toLocaleString('th-TH')
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-medium">
                      {log.user?.username || log.username || log.user_id || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        {log.action || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{log.resource_type || '-'}</td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                      {log.resource_id || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          log.result === 'SUCCESS' || log.result === 'success'
                            ? 'bg-green-50 text-green-700'
                            : log.result === 'FAILURE' || log.result === 'failure' || log.result === 'ERROR'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-gray-50 text-gray-700'
                        }`}
                      >
                        {log.result || '-'}
                      </span>
                    </td>
                  </tr>
                ))
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
