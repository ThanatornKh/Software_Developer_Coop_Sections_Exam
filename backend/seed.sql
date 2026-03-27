-- Seed data for Fleet Management Platform

-- Users (passwords: admin/admin123, dispatcher/dispatch123)
INSERT INTO users (id, username, password_hash, role) VALUES
('usr_001', 'admin', '$2b$10$y3lM9yKHvCzMjJTT0fbZCOWY.jl2wE0Gw7LKu8wyNOJIgjjhzqDWi', 'ADMIN'),
('usr_002', 'dispatcher', '$2b$10$Ip.mpFowD6boSAEI4D8wl.y01dOKWWG7G5qMQN5tir.R1fJh3blya', 'DISPATCHER');

-- Drivers
INSERT INTO drivers (id, name, license_number, license_expires_at, phone, status) VALUES
('drv_001', 'Somchai Prasert', 'DL-TH-2024-001', '2026-12-31', '081-234-5678', 'ACTIVE'),
('drv_002', 'Nattapong Suksai', 'DL-TH-2024-002', '2026-04-15', '082-345-6789', 'ACTIVE'),
('drv_003', 'Wichai Janthorn', 'DL-TH-2024-003', '2025-01-15', '083-456-7890', 'ACTIVE'),
('drv_004', 'Prakit Wongsa', 'DL-TH-2024-004', '2027-06-30', '084-567-8901', 'INACTIVE');

-- Vehicles
INSERT INTO vehicles (id, license_plate, type, status, driver_id, brand, model, year, fuel_type, mileage_km, last_service_km, next_service_km) VALUES
('veh_001', 'กข-1234', 'TRUCK', 'ACTIVE', 'drv_001', 'Isuzu', 'FRR', 2022, 'DIESEL', 45000, 40000, 50000),
('veh_002', 'ขค-5678', 'VAN', 'ACTIVE', 'drv_002', 'Toyota', 'Hiace', 2023, 'DIESEL', 28000, 25000, 30000),
('veh_003', 'คง-9012', 'PICKUP', 'IDLE', NULL, 'Ford', 'Ranger', 2021, 'DIESEL', 62000, 60000, 65000),
('veh_004', 'งจ-3456', 'MOTORCYCLE', 'MAINTENANCE', NULL, 'Honda', 'PCX160', 2023, 'GASOLINE', 15000, 10000, 20000),
('veh_005', 'จฉ-7890', 'TRUCK', 'IDLE', NULL, 'Hino', '500', 2020, 'DIESEL', 98000, 95000, 100000),
('veh_006', 'ฉช-2345', 'VAN', 'RETIRED', NULL, 'Nissan', 'Urvan', 2018, 'DIESEL', 150000, 145000, 155000);

-- Trips
INSERT INTO trips (id, vehicle_id, driver_id, status, origin, destination, distance_km, cargo_type, cargo_weight_kg, started_at, ended_at) VALUES
('trp_001', 'veh_001', 'drv_001', 'IN_PROGRESS', 'Bangkok Warehouse', 'Chiang Mai Hub', 700.00, 'GENERAL', 2500.00, '2026-03-27 06:00:00', NULL),
('trp_002', 'veh_002', 'drv_002', 'SCHEDULED', 'Bangkok Warehouse', 'Phuket Distribution', 860.50, 'REFRIGERATED', 1800.00, NULL, NULL),
('trp_003', 'veh_001', 'drv_001', 'COMPLETED', 'Bangkok Warehouse', 'Khon Kaen Depot', 450.00, 'GENERAL', 3000.00, '2026-03-25 05:00:00', '2026-03-25 14:00:00'),
('trp_004', 'veh_003', 'drv_003', 'COMPLETED', 'Chiang Mai Hub', 'Bangkok Warehouse', 700.00, 'HAZARDOUS', 500.00, '2026-03-24 08:00:00', '2026-03-24 20:00:00'),
('trp_005', 'veh_005', 'drv_001', 'SCHEDULED', 'Bangkok Warehouse', 'Surat Thani', 650.00, 'FRAGILE', 1200.00, NULL, NULL);

-- Checkpoints for trip trp_001 (IN_PROGRESS)
INSERT INTO checkpoints (id, trip_id, sequence, status, location_name, latitude, longitude, purpose, notes, arrived_at, departed_at) VALUES
('chk_001', 'trp_001', 1, 'DEPARTED', 'Nakhon Sawan Rest Stop', 15.7047, 100.1371, 'FUEL', 'Refuel stop', '2026-03-27 09:00:00', '2026-03-27 09:30:00'),
('chk_002', 'trp_001', 2, 'ARRIVED', 'Kamphaeng Phet Checkpoint', 16.4827, 99.5226, 'INSPECTION', 'Weight inspection', '2026-03-27 11:00:00', NULL),
('chk_003', 'trp_001', 3, 'PENDING', 'Lampang Rest Area', 18.2888, 99.4906, 'REST', 'Driver rest break', NULL, NULL),
('chk_004', 'trp_001', 4, 'PENDING', 'Chiang Mai Hub Gate', 18.7883, 98.9853, 'DELIVERY', 'Final delivery point', NULL, NULL);

-- Checkpoints for trip trp_003 (COMPLETED)
INSERT INTO checkpoints (id, trip_id, sequence, status, location_name, latitude, longitude, purpose, notes, arrived_at, departed_at) VALUES
('chk_005', 'trp_003', 1, 'DEPARTED', 'Saraburi Fuel Station', 14.5289, 100.9107, 'FUEL', 'Diesel refuel', '2026-03-25 07:00:00', '2026-03-25 07:20:00'),
('chk_006', 'trp_003', 2, 'DEPARTED', 'Nakhon Ratchasima Rest', 14.9799, 102.0978, 'REST', 'Lunch break', '2026-03-25 10:00:00', '2026-03-25 10:45:00');

-- Checkpoints for trip trp_002 (SCHEDULED)
INSERT INTO checkpoints (id, trip_id, sequence, status, location_name, latitude, longitude, purpose, notes) VALUES
('chk_007', 'trp_002', 1, 'PENDING', 'Hua Hin Fuel Stop', 12.5684, 99.9577, 'FUEL', 'Refuel point'),
('chk_008', 'trp_002', 2, 'PENDING', 'Chumphon Rest Area', 10.4930, 99.1800, 'REST', 'Driver rest'),
('chk_009', 'trp_002', 3, 'PENDING', 'Surat Thani Checkpoint', 9.1382, 99.3217, 'INSPECTION', 'Cargo inspection');

-- Maintenance records
INSERT INTO maintenance (id, vehicle_id, status, type, scheduled_at, completed_at, mileage_at_service, technician, cost_thb, notes) VALUES
('mnt_001', 'veh_004', 'IN_PROGRESS', 'ENGINE', '2026-03-20 09:00:00', NULL, 15000, 'Anon Mechanic Shop', 8500.00, 'Engine overheating issue'),
('mnt_002', 'veh_001', 'COMPLETED', 'OIL_CHANGE', '2026-03-15 08:00:00', '2026-03-15 10:00:00', 40000, 'Isuzu Service Center', 3200.00, 'Regular oil change and filter'),
('mnt_003', 'veh_003', 'SCHEDULED', 'TIRE', '2026-03-22 09:00:00', NULL, NULL, NULL, NULL, 'Tire rotation and inspection');

-- Maintenance parts
INSERT INTO maintenance_parts (id, maintenance_id, part_name, part_number, quantity, cost_thb) VALUES
('mtp_001', 'mnt_002', 'Engine Oil 10W-40', 'OIL-10W40-5L', 2, 1200.00),
('mtp_002', 'mnt_002', 'Oil Filter', 'FLT-ISZ-001', 1, 350.00),
('mtp_003', 'mnt_001', 'Thermostat', 'THM-HND-160', 1, 1500.00);
