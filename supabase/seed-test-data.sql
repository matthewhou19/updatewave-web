-- Seed data for testing the full client storyline
-- Run AFTER schema.sql

-- Insert test user (simulates create_user_hashes.py output)
INSERT INTO users (hash, name, company, email, city_filter, source_campaign)
VALUES (
  'a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ',
  'Mike Johnson',
  'Pacific Coast Builders',
  'mike@pacificcoastbuilders.com',
  'Los Altos',
  'test'
)
ON CONFLICT (hash) DO NOTHING;

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
WHERE u.hash = 'a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ'
  AND p.address = '336 SPRINGER RD'
  AND p.city = 'Los Altos'
ON CONFLICT (user_id, project_id) DO NOTHING;

-- Test list_purchase: test user bought the SJ 2025 'report'-tier city list
-- (the city_list row itself is auto-seeded by migration 002 with service_tier='report')
INSERT INTO list_purchases (user_id, city_list_id, stripe_session_id, stripe_payment_id, amount_cents)
SELECT u.id, cl.id, 'cs_test_seed_list_001', 'pi_test_seed_list_001', 34900
FROM users u, city_lists cl
WHERE u.hash = 'a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ'
  AND cl.city = 'sj'
  AND cl.year = 2025
  AND cl.service_tier = 'report'
ON CONFLICT (user_id, city_list_id) DO NOTHING;

-- Test research city_list: Los Altos 2025 research-tier product
INSERT INTO city_lists (
  city, year, title, description, headline_insight,
  price_cents, anchor_price_cents, pdf_storage_path,
  service_tier, delivery_window_days, active
)
VALUES (
  'la',
  2025,
  'Los Altos 2025 Custom Market Research',
  'Bespoke 5-10 business day research deliverable: every architect, every developer, every contact tied to your target permits.',
  'Hand-built by us. Includes 90-day post-purchase digest of new permits.',
  199900,
  249900,
  'la-2025-research.pdf',
  'research',
  10,
  true
)
ON CONFLICT (city, year, service_tier) DO NOTHING;

-- Test research_purchase: test user bought the LA 2025 research (still being researched)
INSERT INTO research_purchases (
  user_id, city_list_id, stripe_session_id, stripe_payment_id,
  amount_cents, delivery_status, digest_subscription_until
)
SELECT u.id, cl.id, 'cs_test_seed_research_001', 'pi_test_seed_research_001',
       199900, 'in_research', NOW() + INTERVAL '90 days'
FROM users u, city_lists cl
WHERE u.hash = 'a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ'
  AND cl.city = 'la'
  AND cl.year = 2025
  AND cl.service_tier = 'research'
ON CONFLICT (user_id, city_list_id) DO NOTHING;
