create table if not exists rooms (
  code text primary key,
  name text not null,
  locked_utc_hour integer,
  created_at timestamptz not null default now()
);

create table if not exists members (
  id text primary key,
  room_code text not null references rooms(code) on delete cascade,
  token text not null unique,
  name text not null,
  city text not null,
  country text not null,
  tz text not null,
  flag text not null default '🌍',
  updated_at timestamptz not null default now()
);

create index if not exists members_room_code_idx on members(room_code);
