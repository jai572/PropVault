-- Remove 47 Constitution St and 440 George St from properties
-- Run this only if 003_seed_properties.sql was already executed in Supabase

DELETE FROM properties WHERE address_line_1 = '47 Constitution St';
DELETE FROM properties WHERE address_line_1 = '440 George St';
