-- Garden of Arguments: schema, row level security and search.
-- Every row belongs to one auth user (anonymous users included). Clients only
-- ever see and change their own rows; embeddings and tree positions are written
-- by the `embed` Edge Function or by security-definer functions, never by clients.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  updated_at timestamptz not null default now()
);

-- The people who show up in a user's arguments (including "Me"), each with a colour.
create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_me boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index people_one_me on public.people (user_id) where is_me;
create index people_user on public.people (user_id);

-- One argument = one tree.
create table public.arguments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  settled boolean not null default false,
  x double precision not null default 0,
  z double precision not null default 0,
  placed_by_meaning boolean not null default false,
  centroid extensions.vector(384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index arguments_user on public.arguments (user_id);
create index arguments_centroid on public.arguments using hnsw (centroid extensions.vector_cosine_ops);

-- Who was in the argument (2 to 6 people).
create table public.argument_people (
  argument_id uuid not null references public.arguments on delete cascade,
  person_id uuid not null references public.people on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (argument_id, person_id)
);
create index argument_people_user on public.argument_people (user_id);

-- One point someone made = one branch.
create table public.points (
  id uuid primary key default gen_random_uuid(),
  argument_id uuid not null references public.arguments on delete cascade,
  person_id uuid not null references public.people on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 2000),
  embedding extensions.vector(384),
  created_at timestamptz not null default now()
);
create index points_argument on public.points (argument_id);
create index points_user on public.points (user_id);
create index points_embedding on public.points using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Privileges: nothing for signed-out requests, column-level for signed-in users
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.people, public.arguments, public.argument_people, public.points
  from anon, authenticated, public;

grant select (id, display_name, updated_at), insert (id, display_name), update (display_name)
  on public.profiles to authenticated;
grant select (id, user_id, name, color, is_me, created_at), insert (name, color), update (name, color)
  on public.people to authenticated;
grant select (id, user_id, title, settled, x, z, placed_by_meaning, created_at, updated_at),
  insert (title), update (title, settled), delete
  on public.arguments to authenticated;
grant select (argument_id, person_id, user_id), insert (argument_id, person_id), delete
  on public.argument_people to authenticated;
grant select (id, argument_id, person_id, user_id, text, created_at),
  insert (argument_id, person_id, text), update (text), delete
  on public.points to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.people enable row level security;
alter table public.arguments enable row level security;
alter table public.argument_people enable row level security;
alter table public.points enable row level security;

create policy "read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "create own profile" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "rename own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "read own people" on public.people for select to authenticated
  using (user_id = (select auth.uid()));
create policy "add own people" on public.people for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "edit own people" on public.people for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "read own arguments" on public.arguments for select to authenticated
  using (user_id = (select auth.uid()));
create policy "add own arguments" on public.arguments for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "edit own arguments" on public.arguments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own arguments" on public.arguments for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "read own argument people" on public.argument_people for select to authenticated
  using (user_id = (select auth.uid()));
create policy "add people to own arguments" on public.argument_people for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.arguments a where a.id = argument_id and a.user_id = (select auth.uid()))
    and exists (select 1 from public.people p where p.id = person_id and p.user_id = (select auth.uid()))
  );
create policy "remove people from own arguments" on public.argument_people for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "read own points" on public.points for select to authenticated
  using (user_id = (select auth.uid()));
create policy "add points to own arguments" on public.points for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.argument_people ap
      where ap.argument_id = points.argument_id
        and ap.person_id = points.person_id
        and ap.user_id = (select auth.uid())
    )
  );
create policy "edit own points" on public.points for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own points" on public.points for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- New user (anonymous or not): give them a friendly name and a "Me" person.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  adjectives text[] := array['Stubborn','Gentle','Grumpy','Sunny','Prickly','Patient','Wobbly','Brave',
    'Sleepy','Feisty','Quiet','Curious','Mossy','Rusty','Cheeky','Steady'];
  plants text[] := array['Fern','Cactus','Willow','Oak','Daisy','Thistle','Maple','Clover',
    'Bamboo','Tulip','Pine','Ivy','Sprout','Acorn','Bramble','Lotus'];
  fun_name text;
begin
  fun_name := adjectives[1 + floor(random() * array_length(adjectives, 1))::int] || ' '
    || plants[1 + floor(random() * array_length(plants, 1))::int] || ' '
    || (10 + floor(random() * 90)::int)::text;
  insert into public.profiles (id, display_name) values (new.id, fun_name)
    on conflict (id) do nothing;
  insert into public.people (user_id, name, color, is_me) values (new.id, 'Me', '#3fa34d', true)
    on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.display_name := btrim(new.display_name);
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_profile();

-- At most 6 people per argument.
create or replace function public.limit_argument_people()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.argument_people where argument_id = new.argument_id) >= 6 then
    raise exception 'An argument can have at most 6 people';
  end if;
  return new;
end;
$$;
create trigger argument_people_limit before insert on public.argument_people
  for each row execute function public.limit_argument_people();

-- New trees start in a free patch of ground; they move next to similar trees
-- once their first point has been embedded (see place_argument).
create or replace function public.free_spot(uid uuid, cx double precision, cz double precision,
  rmin double precision, rmax double precision, skip_id uuid default null)
returns double precision[]
language plpgsql security definer set search_path = '' as $$
declare
  tries int := 0;
  ang double precision;
  rad double precision;
  px double precision;
  pz double precision;
  nearest double precision;
begin
  loop
    tries := tries + 1;
    ang := random() * 2 * pi();
    rad := rmin + random() * (rmax - rmin) + tries * 0.15;
    px := cx + cos(ang) * rad;
    pz := cz + sin(ang) * rad;
    select min(sqrt(power(a.x - px, 2) + power(a.z - pz, 2))) into nearest
      from public.arguments a
      where a.user_id = uid and (skip_id is null or a.id <> skip_id);
    if (nearest is null or nearest >= 4.5) and sqrt(px * px + pz * pz) > 4 then
      return array[px, pz];
    end if;
    if tries > 60 then
      return array[px, pz];
    end if;
  end loop;
end;
$$;

create or replace function public.prepare_argument()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  n int;
  spot double precision[];
begin
  new.title := btrim(new.title);
  select count(*) into n from public.arguments where user_id = new.user_id;
  spot := public.free_spot(new.user_id, 0, 0, 7, 10 + 4 * sqrt(n));
  new.x := spot[1];
  new.z := spot[2];
  new.placed_by_meaning := false;
  new.centroid := null;
  return new;
end;
$$;
create trigger arguments_prepare before insert on public.arguments
  for each row execute function public.prepare_argument();

create or replace function public.touch_argument()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.title := btrim(new.title);
  return new;
end;
$$;
create trigger arguments_touch before update on public.arguments
  for each row execute function public.touch_argument();

-- Editing a point's words clears its embedding so it gets re-embedded.
create or replace function public.reset_point_embedding()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.text := btrim(new.text);
  if new.text is distinct from old.text then
    new.embedding := null;
  end if;
  return new;
end;
$$;
create trigger points_reset_embedding before update on public.points
  for each row execute function public.reset_point_embedding();

-- A tree's meaning is the average of its points' meanings.
create or replace function public.refresh_centroid()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  arg uuid := coalesce(new.argument_id, old.argument_id);
begin
  update public.arguments a
    set centroid = (
      select extensions.avg(p.embedding) from public.points p
      where p.argument_id = arg and p.embedding is not null
    ),
    updated_at = now()
    where a.id = arg;
  return null;
end;
$$;
create trigger points_refresh_centroid after insert or delete or update of embedding on public.points
  for each row execute function public.refresh_centroid();

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Move a new tree next to the trees it is most similar to (only once).
-- Called by the embed Edge Function with the service role.
create or replace function public.place_argument(arg uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c extensions.vector(384);
  uid uuid;
  r record;
  wx double precision := 0;
  wz double precision := 0;
  ws double precision := 0;
  spot double precision[];
begin
  select a.centroid, a.user_id into c, uid
    from public.arguments a where a.id = arg and not a.placed_by_meaning;
  if c is null then
    return;
  end if;
  for r in
    select a.x, a.z, 1 - (a.centroid operator(extensions.<=>) c) as sim
    from public.arguments a
    where a.user_id = uid and a.id <> arg and a.centroid is not null
    order by a.centroid operator(extensions.<=>) c
    limit 4
  loop
    if r.sim >= 0.82 then
      wx := wx + r.x * r.sim;
      wz := wz + r.z * r.sim;
      ws := ws + r.sim;
    end if;
  end loop;
  if ws > 0 then
    spot := public.free_spot(uid, wx / ws, wz / ws, 3.5, 6, arg);
    update public.arguments set x = spot[1], z = spot[2], placed_by_meaning = true where id = arg;
  else
    update public.arguments set placed_by_meaning = true where id = arg;
  end if;
end;
$$;

-- Points (from the caller's own garden) closest in meaning to a query vector.
create or replace function public.match_points(q extensions.vector(384), n int default 10,
  exclude_argument uuid default null)
returns table (id uuid, argument_id uuid, person_id uuid, text text, similarity double precision)
language sql stable security definer set search_path = '' as $$
  select p.id, p.argument_id, p.person_id, p.text,
         1 - (p.embedding operator(extensions.<=>) q) as similarity
  from public.points p
  where p.user_id = auth.uid()
    and p.embedding is not null
    and (exclude_argument is null or p.argument_id <> exclude_argument)
  order by p.embedding operator(extensions.<=>) q
  limit least(greatest(n, 1), 50);
$$;

-- Points from other arguments that sound like this argument ("this has come up before").
create or replace function public.similar_points(arg uuid, n int default 6)
returns table (id uuid, argument_id uuid, person_id uuid, text text, similarity double precision)
language sql stable security definer set search_path = '' as $$
  select m.*
  from public.arguments a
  cross join lateral public.match_points(a.centroid, n, a.id) m
  where a.id = arg and a.user_id = auth.uid() and a.centroid is not null;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.limit_argument_people() from public, anon, authenticated;
revoke execute on function public.free_spot(uuid, double precision, double precision, double precision, double precision, uuid) from public, anon, authenticated;
revoke execute on function public.prepare_argument() from public, anon, authenticated;
revoke execute on function public.refresh_centroid() from public, anon, authenticated;
revoke execute on function public.place_argument(uuid) from public, anon, authenticated;
revoke execute on function public.match_points(extensions.vector, int, uuid) from public, anon;
revoke execute on function public.similar_points(uuid, int) from public, anon;
grant execute on function public.match_points(extensions.vector, int, uuid) to authenticated;
grant execute on function public.similar_points(uuid, int) to authenticated;
grant execute on function public.place_argument(uuid) to service_role;
