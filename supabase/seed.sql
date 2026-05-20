-- =====================================================================
-- Seed data: demo suppliers (registered / not_registered / unknown).
-- Idempotent — safe to re-run.
-- =====================================================================

insert into public.suppliers (name, status, category) values
  ('הסעות הצפון בע"מ',  'registered',     'הסעות'),
  ('ODT ישראל',          'registered',     'פעילות אתגרית'),
  ('קייטרינג הבית',      'not_registered', 'אוכל'),
  ('יועצי אסטרטגיה ABC', 'registered',     'ייעוץ'),
  ('מלון הגליל',         'unknown',        'לינה'),
  ('מרכז למידה אורנים',  'not_registered', 'הדרכה'),
  ('מחשוב ישיר',         'registered',     'מחשוב')
on conflict (name) do update
  set status   = excluded.status,
      category = excluded.category;
