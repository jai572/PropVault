-- Add Section 6 adoption questions to landlord_survey_responses
ALTER TABLE landlord_survey_responses
  ADD COLUMN adoption_most_annoying    TEXT,
  ADD COLUMN adoption_admin_hours      TEXT,
  ADD COLUMN adoption_portal_interest  TEXT,
  ADD COLUMN adoption_top_priority     TEXT,
  ADD COLUMN adoption_switching_barrier TEXT;
