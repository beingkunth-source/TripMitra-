-- TripMitra Supabase Database Schema
-- Run this script in your Supabase SQL Editor.

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- 1. PROFILES
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row-Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Allow users to update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

--------------------------------------------------------------------------------
-- 2. TRIPS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL, -- Owner/Creator
  destination TEXT NOT NULL,
  origin_city TEXT,
  start_date DATE,
  days INTEGER NOT NULL CHECK (days > 0),
  travelers INTEGER DEFAULT 1 CHECK (travelers > 0),
  budget_limit NUMERIC DEFAULT 50000,
  expenses JSONB DEFAULT '[]'::jsonb,
  packing_list JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 3. TRIP COLLABORATORS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES public.trips ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE (trip_id, user_id)
);

-- Enable RLS
ALTER TABLE public.trip_collaborators ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- TRIP ACCESS RLS POLICIES FOR TRIPS & COLLABORATORS
--------------------------------------------------------------------------------
CREATE POLICY "Allow owners and collaborators to select trips"
  ON public.trips FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.trip_collaborators
      WHERE trip_collaborators.trip_id = trips.id AND trip_collaborators.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow authenticated users to insert trips"
  ON public.trips FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow owners and collaborator-editors to update trips"
  ON public.trips FOR UPDATE
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.trip_collaborators
      WHERE trip_collaborators.trip_id = trips.id 
        AND trip_collaborators.user_id = auth.uid() 
        AND trip_collaborators.role = 'editor'
    )
  );

CREATE POLICY "Allow owner to delete trips"
  ON public.trips FOR DELETE
  USING (auth.uid() = user_id);

-- Collaborators Policies
CREATE POLICY "Allow members of a trip to select collaborators"
  ON public.trip_collaborators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_collaborators.trip_id AND (trips.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.trip_collaborators tc
        WHERE tc.trip_id = trips.id AND tc.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Allow owners to insert/update/delete collaborators"
  ON public.trip_collaborators FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_collaborators.trip_id AND trips.user_id = auth.uid()
    )
  );

--------------------------------------------------------------------------------
-- 4. TRIP DAYS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES public.trips ON DELETE CASCADE NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number > 0),
  theme TEXT,
  UNIQUE (trip_id, day_number)
);

ALTER TABLE public.trip_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow trip members to select trip days"
  ON public.trip_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_days.trip_id AND (trips.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.trip_collaborators WHERE trip_collaborators.trip_id = trips.id AND trip_collaborators.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Allow trip editors to insert/update/delete trip days"
  ON public.trip_days FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_days.trip_id AND (trips.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.trip_collaborators 
        WHERE trip_collaborators.trip_id = trips.id 
          AND trip_collaborators.user_id = auth.uid() 
          AND trip_collaborators.role = 'editor'
      ))
    )
  );

--------------------------------------------------------------------------------
-- 5. ACTIVITIES
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID REFERENCES public.trip_days ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  time TEXT, -- e.g., "Morning", "Afternoon", "Evening"
  lat NUMERIC,
  lng NUMERIC,
  position INTEGER DEFAULT 0
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow trip members to select activities"
  ON public.activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_days
      JOIN public.trips ON trips.id = trip_days.trip_id
      WHERE trip_days.id = activities.day_id AND (trips.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.trip_collaborators WHERE trip_collaborators.trip_id = trips.id AND trip_collaborators.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Allow trip editors to modify activities"
  ON public.activities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_days
      JOIN public.trips ON trips.id = trip_days.trip_id
      WHERE trip_days.id = activities.day_id AND (trips.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.trip_collaborators 
        WHERE trip_collaborators.trip_id = trips.id 
          AND trip_collaborators.user_id = auth.uid() 
          AND trip_collaborators.role = 'editor'
      ))
    )
  );

--------------------------------------------------------------------------------
-- 6. DESTINATIONS (Pre-seeded static carousel & lookup)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT
);

ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on destinations"
  ON public.destinations FOR SELECT USING (true);

--------------------------------------------------------------------------------
-- 7. HOTELS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES public.trips ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  rating NUMERIC,
  price TEXT,
  image_url TEXT,
  link TEXT
);

ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow trip members to modify hotels"
  ON public.hotels FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = hotels.trip_id AND (trips.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.trip_collaborators WHERE trip_collaborators.trip_id = trips.id AND trip_collaborators.user_id = auth.uid()
      ))
    )
  );

--------------------------------------------------------------------------------
-- 8. FLIGHTS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES public.trips ON DELETE CASCADE NOT NULL,
  airline TEXT NOT NULL,
  price TEXT,
  duration TEXT,
  link TEXT
);

ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow trip members to modify flights"
  ON public.flights FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = flights.trip_id AND (trips.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.trip_collaborators WHERE trip_collaborators.trip_id = trips.id AND trip_collaborators.user_id = auth.uid()
      ))
    )
  );

--------------------------------------------------------------------------------
-- 9. REVIEWS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  trip_id UUID REFERENCES public.trips ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anyone to read reviews"
  ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to write own reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow owner to modify reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Allow owner to delete reviews"
  ON public.reviews FOR DELETE
  USING (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- 10. NOTIFICATIONS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to manage own notifications"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- 11. SAVED TRIPS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  trip_id UUID REFERENCES public.trips ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, trip_id)
);

ALTER TABLE public.saved_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to manage own saved_trips"
  ON public.saved_trips FOR ALL
  USING (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- AUTOMATIC PROFILE TRIGGER ON SIGNUP
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

--------------------------------------------------------------------------------
-- PERFORMANCE INDEXES
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON public.trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_days_trip_id ON public.trip_days(trip_id);
CREATE INDEX IF NOT EXISTS idx_activities_day_id ON public.activities(day_id);
CREATE INDEX IF NOT EXISTS idx_trip_collaborators_trip_id ON public.trip_collaborators(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_collaborators_user_id ON public.trip_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_trips_user_id ON public.saved_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
