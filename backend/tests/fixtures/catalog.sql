-- Test fixtures for a disposable local database only.
BEGIN;
INSERT INTO organizational_units (unit_name, unit_code, unit_type)
VALUES ('Test Administration', 'TEST', 'administrative');
INSERT INTO buildings (building_name) VALUES ('Test Building');
INSERT INTO approval_groups (group_name, unit_id)
VALUES ('Test Review Group', (SELECT unit_id FROM organizational_units WHERE unit_code = 'TEST'));
INSERT INTO venues (venue_name, venue_type, building_id, managing_unit_id, access_id, capacity)
SELECT 'Test Classroom', 'classroom', b.building_id, u.unit_id, ag.access_id, 60
FROM buildings b, organizational_units u, approval_groups ag
WHERE b.building_name = 'Test Building' AND u.unit_code = 'TEST' AND ag.group_name = 'Test Review Group';
COMMIT;
