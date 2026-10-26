-- Optional sample data for an EMPTY LOCAL database only; capacities are examples.
BEGIN;
INSERT INTO organizational_units (unit_name, unit_code, unit_type)
VALUES ('Demo Administration', 'DEMO', 'administrative');
INSERT INTO buildings (building_name) VALUES ('Demo Building');
INSERT INTO approval_groups (group_name, unit_id)
VALUES ('Demo Review Group', (SELECT unit_id FROM organizational_units WHERE unit_code = 'DEMO'));
INSERT INTO venues (venue_name, venue_type, building_id, managing_unit_id, access_id, capacity)
SELECT 'Demo Classroom', 'classroom', b.building_id, u.unit_id, ag.access_id, 60
FROM buildings b, organizational_units u, approval_groups ag
WHERE b.building_name = 'Demo Building' AND u.unit_code = 'DEMO' AND ag.group_name = 'Demo Review Group';
COMMIT;
