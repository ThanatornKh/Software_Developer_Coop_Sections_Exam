import { useState, useEffect, useCallback } from 'react';
import { Truck, Route, Gauge, AlertTriangle } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import client from '../api/client';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';

const VEHICLE_STATUS_COLORS = {
  ACTIVE: '#22c55e',
  IDLE: '#9ca3af',
  MAINTENANCE: '#f97316',
  RETIRED: '#ef4444',
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const res = await client.get('/dashboard/stats');
      setStats(res.data.data || res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) return <LoadingSpinner />;

  const vehiclesByStatus = stats?.vehiclesByStatus
    ? Object.entries(stats.vehiclesByStatus).map(([name, value]) => ({ name, value }))
    : [];

  const tripTrend = stats?.tripDistanceTrend || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Fleet overview and key metrics</p>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Truck}
          label="Total Vehicles"
          value={stats?.totalVehicles ?? 0}
          to="/vehicles"
        />
        <MetricCard
          icon={Route}
          label="Active Trips Today"
          value={stats?.activeTripsToday ?? 0}
          to="/trips?status=IN_PROGRESS"
        />
        <MetricCard
          icon={Gauge}
          label="Total Distance Today"
          value={`${(stats?.totalDistanceToday ?? 0).toLocaleString()} km`}
          to="/trips"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Maintenance Overdue"
          value={stats?.maintenanceOverdue ?? 0}
          to="/maintenance?filter=overdue"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicles by Status Pie Chart */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vehicles by Status</h2>
          {vehiclesByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={vehiclesByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {vehiclesByStatus.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={VEHICLE_STATUS_COLORS[entry.name] || '#6b7280'}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">No data available</p>
          )}
        </div>

        {/* Trip Distance Trend Bar Chart */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Trip Distance Trend (7 days)</h2>
          {tripTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tripTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [`${value} km`, 'Distance']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="distance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">No data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
