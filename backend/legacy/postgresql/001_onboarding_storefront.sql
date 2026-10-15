create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  phone text unique,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references users(id),
  display_name text not null,
  legal_name text,
  subdomain text not null unique,
  category text not null,
  country text not null,
  currency char(3) not null,
  language text not null default 'en',
  status text not null default 'draft' check (status in ('draft', 'launched', 'suspended')),
  onboarding_step text not null default 'products',
  address text,
  logo_url text,
  policy_defaults jsonb not null default '{}'::jsonb,
  selected_template_id text,
  storefront_config jsonb not null default '{"theme":{"accent":"#111827","background":"#ffffff","text":"#111827"},"sections":["hero","products"],"seo":{}}'::jsonb,
  ai_mode text not null default 'suggest' check (ai_mode in ('off', 'suggest', 'auto_low_risk')),
  launched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shop_staff (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null,
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  unique (shop_id, user_id)
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  base_price numeric(12,2) not null check (base_price >= 0),
  currency char(3) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, slug)
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  sku text,
  title text not null,
  price numeric(12,2) not null check (price >= 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, sku)
);

create table if not exists asset_objects (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  storage_driver text not null check (storage_driver in ('local', 's3')),
  bucket text not null,
  object_key text not null,
  public_url text not null,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0),
  purpose text not null,
  created_by text,
  created_at timestamptz not null default now(),
  unique (storage_driver, bucket, object_key)
);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  asset_id uuid not null references asset_objects(id) on delete restrict,
  sort_order integer not null default 0,
  alt_text text,
  created_at timestamptz not null default now()
);

create table if not exists inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  reason text not null,
  delta_quantity integer not null,
  quantity_after integer not null check (quantity_after >= 0),
  reference_type text,
  reference_id uuid,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  actor_type text not null,
  actor_id text,
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists shop_channels (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  provider text not null check (provider in ('meta', 'instagram', 'whatsapp', 'courier')),
  status text not null check (status in ('skipped', 'pending', 'connected', 'failed')),
  reason text,
  created_at timestamptz not null default now(),
  unique (shop_id, provider)
);

create index if not exists shops_subdomain_idx on shops (subdomain);
create index if not exists products_shop_status_idx on products (shop_id, status);
create index if not exists product_variants_shop_product_idx on product_variants (shop_id, product_id);
create index if not exists inventory_ledger_variant_idx on inventory_ledger (shop_id, variant_id, created_at desc);
create index if not exists audit_events_shop_idx on audit_events (shop_id, created_at desc);
create index if not exists shop_channels_shop_idx on shop_channels (shop_id);
