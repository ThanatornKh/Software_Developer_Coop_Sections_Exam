import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Check, MapPin } from 'lucide-react';
import client from '../api/client';
import ErrorAlert from '../components/ErrorAlert';
import LoadingSpinner from '../components/LoadingSpinner';
import { provinces, getProvinceDistance, getProvincesAlongRoute } from '../data/thaiProvinces';

const STEPS = [
  { number: 1, label: 'Vehicle & Driver' },
  { number: 2, label: 'Trip Details' },
  { number: 3, label: 'Checkpoints' },
];

export default function TripCreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [stepErrors, setStepErrors] = useState({});

  // Form data
  const [formData, setFormData] = useState({
    vehicle_id: '',
    driver_id: '',
    origin: '',
    destination: '',
    distance_km: '',
    cargo_type: '',
    cargo_weight_kg: '',
    checkpoints: [
      { province: '', location_name: '', latitude: '', longitude: '', purpose: '', notes: '' },
    ],
  });

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [vehiclesRes, driversRes] = await Promise.all([
          client.get('/vehicles'),
          client.get('/drivers'),
        ]);
        const allVehicles = vehiclesRes.data.data || vehiclesRes.data || [];
        const allDrivers = driversRes.data.data || driversRes.data || [];
        // Filter: IDLE or ACTIVE vehicles, ACTIVE drivers
        setVehicles(allVehicles.filter((v) => v.status === 'IDLE' || v.status === 'ACTIVE'));
        setDrivers(allDrivers.filter((d) => d.status === 'ACTIVE'));
      } catch (err) {
        setError('Failed to load vehicles and drivers.');
      } finally {
        setLoading(false);
      }
    }
    fetchOptions();
  }, []);

  // Auto-calculate distance when origin/destination change
  const autoCalcDistance = useCallback((origin, destination) => {
    if (origin && destination && origin !== destination) {
      const dist = getProvinceDistance(origin, destination);
      if (dist !== null) {
        return String(dist);
      }
    }
    return '';
  }, []);

  const updateField = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-calc distance when changing origin or destination
      if (field === 'origin' || field === 'destination') {
        const o = field === 'origin' ? value : prev.origin;
        const d = field === 'destination' ? value : prev.destination;
        const dist = autoCalcDistance(o, d);
        if (dist) next.distance_km = dist;
      }
      return next;
    });
    setStepErrors({});
  };

  const updateCheckpoint = (index, field, value) => {
    setFormData((prev) => {
      const cps = [...prev.checkpoints];
      cps[index] = { ...cps[index], [field]: value };
      // Auto-fill lat/lng and location_name when province is selected
      if (field === 'province') {
        const prov = provinces.find((p) => p.name_th === value);
        if (prov) {
          cps[index].location_name = prov.name_th;
          cps[index].latitude = String(prov.lat);
          cps[index].longitude = String(prov.lng);
        } else {
          cps[index].location_name = '';
          cps[index].latitude = '';
          cps[index].longitude = '';
        }
      }
      return { ...prev, checkpoints: cps };
    });
    setStepErrors({});
  };

  // Get route-aware province list for checkpoints
  const routeProvinces = formData.origin && formData.destination
    ? getProvincesAlongRoute(formData.origin, formData.destination)
    : [];
  const allOtherProvinces = provinces.filter(
    (p) =>
      p.name_th !== formData.origin &&
      p.name_th !== formData.destination &&
      !routeProvinces.some((rp) => rp.name_th === p.name_th)
  );

  const addCheckpoint = () => {
    setFormData((prev) => ({
      ...prev,
      checkpoints: [
        ...prev.checkpoints,
        { province: '', location_name: '', latitude: '', longitude: '', purpose: '', notes: '' },
      ],
    }));
  };

  const removeCheckpoint = (index) => {
    if (formData.checkpoints.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      checkpoints: prev.checkpoints.filter((_, i) => i !== index),
    }));
  };

  const validateStep = (stepNum) => {
    const errors = {};

    if (stepNum === 1) {
      if (!formData.vehicle_id) errors.vehicle_id = 'Please select a vehicle.';
      if (!formData.driver_id) errors.driver_id = 'Please select a driver.';
    }

    if (stepNum === 2) {
      if (!formData.origin.trim()) errors.origin = 'Origin is required.';
      if (!formData.destination.trim()) errors.destination = 'Destination is required.';
      if (!formData.distance_km || parseFloat(formData.distance_km) <= 0)
        errors.distance_km = 'Distance must be a positive number.';
    }

    if (stepNum === 3) {
      formData.checkpoints.forEach((cp, i) => {
        if (!cp.location_name.trim()) {
          errors[`cp_${i}_location`] = `Checkpoint ${i + 1}: Location name is required.`;
        }
      });
      if (formData.checkpoints.length === 0) {
        errors.checkpoints = 'At least one checkpoint is required.';
      }
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setStep((s) => s - 1);
    setStepErrors({});
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        vehicle_id: formData.vehicle_id,
        driver_id: formData.driver_id,
        origin: formData.origin,
        destination: formData.destination,
        distance_km: parseFloat(formData.distance_km),
        cargo_type: formData.cargo_type || undefined,
        cargo_weight_kg: formData.cargo_weight_kg
          ? parseFloat(formData.cargo_weight_kg)
          : undefined,
        checkpoints: formData.checkpoints.map((cp, idx) => ({
          location_name: cp.location_name,
          latitude: cp.latitude ? parseFloat(cp.latitude) : undefined,
          longitude: cp.longitude ? parseFloat(cp.longitude) : undefined,
          purpose: cp.purpose || undefined,
          notes: cp.notes || undefined,
          sequence: idx + 1,
        })),
      };

      const res = await client.post('/trips', payload);
      const tripId = res.data.data?.id || res.data.id;
      navigate(`/trips/${tripId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create trip.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/trips')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create New Trip</h1>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, idx) => (
          <div key={s.number} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step > s.number
                    ? 'bg-green-500 text-white'
                    : step === s.number
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s.number ? <Check className="h-4 w-4" /> : s.number}
              </div>
              <span
                className={`text-sm font-medium hidden sm:inline ${
                  step === s.number ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-2 ${
                  step > s.number ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

      <div className="card">
        {/* Step 1: Vehicle & Driver */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Select Vehicle & Driver</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle *</label>
              <select
                value={formData.vehicle_id}
                onChange={(e) => updateField('vehicle_id', e.target.value)}
                className={`input-field ${stepErrors.vehicle_id ? 'border-red-300' : ''}`}
              >
                <option value="">Select a vehicle...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.license_plate} - {v.brand} {v.model} ({v.status})
                  </option>
                ))}
              </select>
              {stepErrors.vehicle_id && (
                <p className="text-xs text-red-500 mt-1">{stepErrors.vehicle_id}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver *</label>
              <select
                value={formData.driver_id}
                onChange={(e) => updateField('driver_id', e.target.value)}
                className={`input-field ${stepErrors.driver_id ? 'border-red-300' : ''}`}
              >
                <option value="">Select a driver...</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} - {d.license_number}
                  </option>
                ))}
              </select>
              {stepErrors.driver_id && (
                <p className="text-xs text-red-500 mt-1">{stepErrors.driver_id}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Trip Details */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Trip Details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="inline h-3.5 w-3.5 mr-1 text-blue-500" />
                  Origin (ต้นทาง) *
                </label>
                <select
                  value={formData.origin}
                  onChange={(e) => updateField('origin', e.target.value)}
                  className={`input-field ${stepErrors.origin ? 'border-red-300' : ''}`}
                >
                  <option value="">-- เลือกจังหวัดต้นทาง --</option>
                  {provinces.map((p) => (
                    <option key={p.name_th} value={p.name_th}>
                      {p.name_th} ({p.name_en})
                    </option>
                  ))}
                </select>
                {stepErrors.origin && (
                  <p className="text-xs text-red-500 mt-1">{stepErrors.origin}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="inline h-3.5 w-3.5 mr-1 text-red-500" />
                  Destination (ปลายทาง) *
                </label>
                <select
                  value={formData.destination}
                  onChange={(e) => updateField('destination', e.target.value)}
                  className={`input-field ${stepErrors.destination ? 'border-red-300' : ''}`}
                >
                  <option value="">-- เลือกจังหวัดปลายทาง --</option>
                  {provinces.map((p) => (
                    <option key={p.name_th} value={p.name_th}>
                      {p.name_th} ({p.name_en})
                    </option>
                  ))}
                </select>
                {stepErrors.destination && (
                  <p className="text-xs text-red-500 mt-1">{stepErrors.destination}</p>
                )}
                {formData.origin && formData.destination && formData.origin === formData.destination && (
                  <p className="text-xs text-yellow-600 mt-1">ต้นทางและปลายทางเป็นจังหวัดเดียวกัน</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Distance (km) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.distance_km}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, distance_km: e.target.value }));
                    setStepErrors({});
                  }}
                  className={`input-field ${stepErrors.distance_km ? 'border-red-300' : ''}`}
                  placeholder="0.0"
                />
                {formData.origin && formData.destination && formData.distance_km && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    คำนวณอัตโนมัติ
                  </span>
                )}
              </div>
              {stepErrors.distance_km && (
                <p className="text-xs text-red-500 mt-1">{stepErrors.distance_km}</p>
              )}
              {formData.origin && formData.destination && formData.distance_km && (
                <p className="text-xs text-gray-500 mt-1">
                  {formData.origin} → {formData.destination} ≈ {formData.distance_km} km (ระยะทางโดยประมาณ สามารถแก้ไขได้)
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cargo Type
                </label>
                <select
                  value={formData.cargo_type}
                  onChange={(e) => updateField('cargo_type', e.target.value)}
                  className="input-field"
                >
                  <option value="">-- เลือกประเภทสินค้า --</option>
                  <option value="GENERAL">GENERAL (ทั่วไป)</option>
                  <option value="FRAGILE">FRAGILE (แตกหักง่าย)</option>
                  <option value="HAZARDOUS">HAZARDOUS (อันตราย)</option>
                  <option value="REFRIGERATED">REFRIGERATED (แช่เย็น)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cargo Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.cargo_weight_kg}
                  onChange={(e) => updateField('cargo_weight_kg', e.target.value)}
                  className="input-field"
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Checkpoints */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Checkpoints</h2>
              <button onClick={addCheckpoint} className="btn-secondary text-sm py-1.5">
                <Plus className="h-4 w-4 mr-1" />
                Add Checkpoint
              </button>
            </div>

            {stepErrors.checkpoints && (
              <p className="text-xs text-red-500">{stepErrors.checkpoints}</p>
            )}

            {/* Route info */}
            {formData.origin && formData.destination && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <MapPin className="inline h-3.5 w-3.5 mr-1" />
                เส้นทาง: <strong>{formData.origin}</strong> → <strong>{formData.destination}</strong>
                {formData.distance_km && <span className="ml-2">({formData.distance_km} km)</span>}
                {routeProvinces.length > 0 && (
                  <span className="ml-2 text-blue-600">
                    • พบ {routeProvinces.length} จังหวัดบนเส้นทาง
                  </span>
                )}
              </div>
            )}

            <div className="space-y-4">
              {formData.checkpoints.map((cp, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      <MapPin className="inline h-3.5 w-3.5 mr-1 text-orange-500" />
                      Checkpoint {idx + 1}
                    </span>
                    {formData.checkpoints.length > 1 && (
                      <button
                        onClick={() => removeCheckpoint(idx)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Province selector */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        จังหวัดที่ผ่าน (Province) *
                      </label>
                      <select
                        value={cp.province}
                        onChange={(e) => updateCheckpoint(idx, 'province', e.target.value)}
                        className={`input-field ${
                          stepErrors[`cp_${idx}_location`] ? 'border-red-300' : ''
                        }`}
                      >
                        <option value="">-- เลือกจังหวัด --</option>
                        {routeProvinces.length > 0 && (
                          <optgroup label={`📍 จังหวัดบนเส้นทาง (${formData.origin} → ${formData.destination})`}>
                            {routeProvinces.map((p) => (
                              <option key={p.name_th} value={p.name_th}>
                                {p.name_th} ({p.name_en})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="จังหวัดอื่น ๆ">
                          {allOtherProvinces.map((p) => (
                            <option key={p.name_th} value={p.name_th}>
                              {p.name_th} ({p.name_en})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      {stepErrors[`cp_${idx}_location`] && (
                        <p className="text-xs text-red-500 mt-1">
                          {stepErrors[`cp_${idx}_location`]}
                        </p>
                      )}
                      {cp.province && cp.latitude && cp.longitude && (
                        <p className="text-xs text-gray-400 mt-1">
                          พิกัด: {cp.latitude}, {cp.longitude}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Purpose (วัตถุประสงค์) *
                      </label>
                      <select
                        value={cp.purpose}
                        onChange={(e) => updateCheckpoint(idx, 'purpose', e.target.value)}
                        className="input-field"
                      >
                        <option value="">-- เลือกวัตถุประสงค์ --</option>
                        <option value="FUEL">FUEL (เติมน้ำมัน)</option>
                        <option value="REST">REST (พักผ่อน)</option>
                        <option value="DELIVERY">DELIVERY (ส่งของ)</option>
                        <option value="PICKUP">PICKUP (รับของ)</option>
                        <option value="INSPECTION">INSPECTION (ตรวจสอบ)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Notes (หมายเหตุ)
                      </label>
                      <input
                        type="text"
                        value={cp.notes}
                        onChange={(e) => updateCheckpoint(idx, 'notes', e.target.value)}
                        className="input-field"
                        placeholder="หมายเหตุเพิ่มเติม"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
          {step > 1 ? (
            <button onClick={handleBack} className="btn-secondary">
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button onClick={handleNext} className="btn-primary">
              Next
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create Trip'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
