-- migration v11: credit score & suspension for user_profiles

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS credit_score integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
