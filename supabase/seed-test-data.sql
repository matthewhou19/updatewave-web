-- Seed data for testing the full client storyline
-- Run AFTER schema.sql

-- Insert test user (simulates create_user_hashes.py output)
INSERT INTO users (hash, name, company, email, city_filter, source_campaign)
VALUES (
  'test_abcdefghijklmnopqrstuvwxyz1234567890A',
  'Mike Johnson',
  'Pacific Coast Builders',
  'mike@pacificcoastbuilders.com',
  'Los Altos',
  'test'
);

-- Insert test projects (simulates publish_leads.py output)
INSERT INTO projects (city, address, project_type, estimated_value_cents, estimated_value, architect_name, architect_firm, architect_contact, architect_website, source_permit_id, filing_date, source_url, status, published_at)
VALUES
  ('Los Altos', '336 SPRINGER RD', 'Design Review Single Family', 250000000, '$2.5M', 'Jia Liu', 'Liu Architecture Studio', 'jia@liuarch.com', 'https://liuarch.com', 1001, '2025-04-01', 'https://trakit.losaltosca.gov/etrakit/Search/project.aspx?ActivityNo=DR25-0031', 'published', now()),
  ('Los Altos', '659 ROSEWOOD CT', 'Design Review Single Family', 180000000, '$1.8M', 'Naz Healy', 'Healy Design Group', 'naz@healydesign.com', 'https://healydesign.com', 1002, '2025-04-02', 'https://trakit.losaltosca.gov/etrakit/Search/project.aspx?ActivityNo=DR25-0032', 'published', now()),
  ('Los Altos', '1275 RICHARDSON AVE', 'Design Review Single Family', 320000000, '$3.2M', 'Sean Gallegos', 'Gallegos Studio', 'sean@gallegosstudio.com', 'https://gallegosstudio.com', 1003, '2025-04-02', 'https://trakit.losaltosca.gov/etrakit/Search/project.aspx?ActivityNo=DR25-0035', 'published', now()),
  ('Palo Alto', '2145 COWPER ST', 'Architectural Review', 450000000, '$4.5M', 'David Chen', 'Chen Architects', 'david@chenarchitects.com', 'https://chenarchitects.com', 1004, '2025-03-28', NULL, 'published', now()),
  ('Palo Alto', '890 UNIVERSITY AVE', 'New Construction Commercial', 1200000000, '$12M', 'Sarah Kim', 'Kim & Associates', 'sarah@kimassoc.com', 'https://kimassoc.com', 1005, '2025-03-25', NULL, 'published', now()),
  ('Mountain View', '450 CASTRO ST', 'Site Development', 85000000, '$850K', 'Roberto Martinez', NULL, NULL, NULL, 1006, '2025-03-30', NULL, 'published', now()),
  ('Los Altos', '100 MAIN ST', 'Design Review Multi-Family', NULL, NULL, 'Tom Wright', 'Wright Residential', NULL, 'https://wrightresidential.com', 1007, '2025-04-03', NULL, 'published', now());

-- Second test user with zero reveals (for empty state E2E test)
INSERT INTO users (hash, name, company, email, city_filter, source_campaign)
VALUES (
  'empty_reveals_test_user_hash_000000000000',
  'Test Empty User',
  'No Reveals Corp',
  'empty@test.local',
  'Los Altos',
  'test'
)
ON CONFLICT (hash) DO NOTHING;

-- Insert a test reveal so /reveals/{hash} has data to render.
-- Uses the first project (336 SPRINGER RD) for the test user.
INSERT INTO reveals (user_id, project_id, stripe_payment_id, amount_cents)
SELECT u.id, p.id, 'pi_test_seed_001', 2500
FROM users u, projects p
WHERE u.hash = 'test_abcdefghijklmnopqrstuvwxyz1234567890A'
  AND p.address = '336 SPRINGER RD'
  AND p.city = 'Los Altos'
ON CONFLICT (user_id, project_id) DO NOTHING;
