-- One-time rescue export from the old Supabase backend (pre-2026-07 versions
-- of this app stored data there). Run in the Supabase SQL editor, copy the
-- single-cell result into a .json file, and use the app's Data → Import.
select json_build_object(
  'version', 1,
  'exported_at', now(),
  'statuses', (select coalesce(json_object_agg(territory_id, status), '{}'::json)
               from public.territory_status),
  'trips', (select coalesce(json_agg(json_build_object(
        'id', t.id,
        'name', t.name,
        'start_date', t.start_date,
        'end_date', t.end_date,
        'notes', t.notes,
        'created_at', t.created_at,
        'territories', (select coalesce(json_agg(json_build_object(
              'territory_id', tt.territory_id, 'status', tt.status)), '[]'::json)
            from public.trip_territories tt where tt.trip_id = t.id)
      ) order by t.created_at), '[]'::json)
    from public.trips t)
);
