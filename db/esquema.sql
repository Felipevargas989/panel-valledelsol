-- ESQUEMA DE LA BASE DEL PANEL (Postgres en Vercel / Neon)
-- Se aplica una vez con `node scripts/preparar-base.mjs`. Es idempotente: se
-- puede volver a correr sin romper nada. Ver docs/ARQUITECTURA.md, sección 4.

create schema if not exists panel;

-- Campañas por día: la tabla madre de la vista Conversiones.
create table if not exists panel.campana_dia (
  fecha          date        not null,
  canal          text        not null check (canal in ('meta', 'google')),
  campana        text        not null,
  inversion      integer     not null default 0,   -- pesos chilenos, sin decimales
  impresiones    integer     not null default 0,
  alcance        integer,                          -- Meta lo da; Google no
  clics          integer     not null default 0,
  leads          integer,                          -- Meta: conversaciones; Google: cotización, reserva o WhatsApp
  intenciones    integer,                          -- solo Google: clics en Cotizar / Reservar
  cotizaciones   integer,                          -- solo Google: cotización enviada o reserva pagada
  actualizado_en timestamptz not null default now(),
  primary key (fecha, canal, campana)
);
create index if not exists campana_dia_fecha on panel.campana_dia (fecha);
-- Para bases creadas antes del 19-09-2026, cuando leads mezclaba WhatsApp con
-- cotizaciones y no existía esta columna.
alter table panel.campana_dia add column if not exists cotizaciones integer;

-- El sitio por día (Analytics).
create table if not exists panel.sitio_dia (
  fecha          date        primary key,
  personas       integer     not null default 0,
  nuevos         integer     not null default 0,
  sesiones       integer     not null default 0,
  interactivas   integer     not null default 0,
  conversiones   integer     not null default 0,   -- solo nuestros siete eventos
  duracion_media real        not null default 0,   -- segundos por sesión
  actualizado_en timestamptz not null default now()
);

-- Desgloses del sitio por día: canal, fuente, ciudad, aparato, sistema, página, entrada.
create table if not exists panel.sitio_desglose (
  fecha          date        not null,
  tipo           text        not null,
  clave          text        not null,
  sesiones       integer     not null default 0,
  personas       integer     not null default 0,
  conversiones   integer     not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (fecha, tipo, clave)
);

-- Radiografía de Meta por día: edad, genero, plataforma, ubicacion, region.
create table if not exists panel.meta_desglose (
  fecha          date        not null,
  tipo           text        not null,
  clave          text        not null,
  gasto          integer     not null default 0,
  conversaciones integer     not null default 0,
  contactos      integer     not null default 0,   -- por región Meta solo entrega contactos
  actualizado_en timestamptz not null default now(),
  primary key (fecha, tipo, clave)
);

-- Registro de cada ingesta: se muestra en la vista Medición.
create table if not exists panel.ingesta (
  id      bigserial   primary key,
  fuente  text        not null,               -- meta | google | sitio
  desde   date        not null,
  hasta   date        not null,
  filas   integer     not null default 0,
  estado  text        not null check (estado in ('ok', 'error')),
  error   text,
  inicio  timestamptz not null default now(),
  fin     timestamptz
);
create index if not exists ingesta_inicio on panel.ingesta (inicio desc);
