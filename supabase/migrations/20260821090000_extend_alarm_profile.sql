alter table public.alarms
  add column if not exists device_slot smallint check (device_slot between 0 and 9),
  add column if not exists sunrise_duration smallint check (sunrise_duration in (15, 30, 45)),
  add column if not exists final_brightness smallint check (final_brightness between 0 and 100),
  add column if not exists sound_id smallint check (sound_id between 0 and 25),
  add column if not exists volume smallint check (volume between 0 and 100);

comment on column public.alarms.device_slot is 'Nullable firmware alarm slot. Not authoritative until device readback is implemented.';
comment on column public.alarms.sunrise_duration is 'Confirmed sunrise duration in minutes.';
comment on column public.alarms.final_brightness is 'Confirmed final alarm brightness percentage.';
comment on column public.alarms.sound_id is 'Confirmed sound identifier. 0 is off; 1-25 are manufacturer audio slots.';
comment on column public.alarms.volume is 'Confirmed alarm volume percentage.';
