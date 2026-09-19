# Panel Valle del Sol — arquitectura v2

**Decidido con Felipe el 18-09-2026.** Este documento manda sobre el código y sobre la
memoria del chat: si una decisión cambia, se cambia primero acá.

## 1. El problema que resuelve

La v1 le preguntaba a Meta y a Google **cada vez que alguien abría la página**. Consecuencias:
la primera carga tardaba 3 s en blanco, cada rango de fechas nuevo era otra tanda de llamadas,
y el 17-09 Meta bloqueó la app por exceso de consultas (nivel «Marketing API Access Tier:
acceso limitado», cupo bajo).

## 2. La idea en una línea

**Traer los datos una vez al día, guardarlos en una base propia y que el dashboard lea solo
la base.** La página deja de depender de las APIs para mostrarse; las APIs solo se tocan en
la ingesta programada y, a pedido, para el día en curso.

```
   Meta (Marketing API) ─┐                        ┌─ /api/datos ──► dashboard (filtros, gráficos)
   Google Analytics ─────┼─► ingesta diaria ─► base ┤
   Google Ads (vía GA4) ─┘   (cron 06:00 CL)        └─ vista Medición (registro de ingestas)

   Google Analytics tiempo real ─────────────────────► «Ahora mismo» (sin pasar por la base)
```

## 3. Componentes

| Capa | Dónde | Qué hace |
|---|---|---|
| Base | **Postgres en Vercel (Neon, plan gratis)** | Guarda campañas por día, sitio por día, desgloses de público y el registro de ingestas. Postgres normal: se exporta cuando se quiera. |
| Ingesta | `app/api/ingesta/route.ts` + cron en `vercel.json` | Cada mañana trae **el día anterior** de las tres fuentes y lo guarda (upsert: si el día ya existe, se reemplaza). Protegida con `CRON_SECRET`. |
| Carga inicial | `scripts/cargar-historia.ts` (se corre una vez, a mano) | Trae la historia desde el 01-01-2025 por tandas, con pausas, y la guarda. No se repite nunca. |
| Lectura | `lib/base.ts` + `app/api/datos/route.ts` | Consultas a la base ya agregadas por día / campaña / mes. Ninguna llamada a APIs externas. |
| Dashboard | vistas del panel | Filtros de fecha, canal y campaña **sin recargar**; comparación con el período anterior y con el año anterior; gráficos interactivos. |
| Tiempo real | `/api/ahora` (ya existe) | «Quién está en el sitio ahora» sigue leyendo Analytics en vivo cada minuto. Su cupo es aparte y generoso. |
| Día en curso | botón «Actualizar hoy» → `/api/ingesta?dia=hoy` | Trae el día de hoy a pedido. Freno: como mucho una vez cada 30 minutos. |

## 4. Modelo de datos

Todas las tablas viven en el esquema `panel`.

| Tabla | Clave | Columnas | Fuente |
|---|---|---|---|
| `campana_dia` | (fecha, canal, campana) | inversion, impresiones, alcance, clics, leads, intenciones, actualizado_en | Meta: campaña × día. Google: GA4 `date × sessionGoogleAdsCampaignName` |
| `sitio_dia` | (fecha) | personas, nuevos, sesiones, interactivas, conversiones, duracion_media | GA4 |
| `sitio_desglose` | (fecha, tipo, clave) | sesiones, personas, conversiones · tipo ∈ canal, fuente, ciudad, aparato, sistema, pagina, entrada | GA4 |
| `meta_desglose` | (fecha, tipo, clave) | gasto, conversaciones, contactos · tipo ∈ edad, genero, plataforma, ubicacion, region | Meta breakdowns × día |
| `ingesta` | id | fuente, desde, hasta, filas, estado, error, inicio, fin | el propio panel |

Definiciones que no cambian (vienen de la v1 y están validadas contra las plataformas):
- **Lead en Meta** = conversación de WhatsApp iniciada (`onsite_conversion.messaging_conversation_started_7d`).
- **Lead en Google** = cotización enviada + reserva pagada + los tres WhatsApp. **Intención** = clics en Cotizar / Reservar.
- **Conversiones del sitio** = solo nuestros siete eventos; los heredados del sitio viejo se guardan aparte y no se suman.
- Clics de Meta = clics al enlace (`inline_link_clicks`), comparables con los de Google.

## 5. Presupuesto de llamadas (la regla que evita otro bloqueo)

| Fuente | Ingesta diaria | Carga inicial (una vez) | Día en curso |
|---|---|---|---|
| Meta | 1 (campaña × día) + 5 desgloses = **6/día** | 1 llamada de campaña × día para 20 meses (paginada) + desgloses solo de los últimos 90 días, con pausa de 3 s entre llamadas | máx. 1 por hora |
| GA4 (sitio + Google Ads) | 3 tandas = **3/día** | 2–3 tandas | máx. 1 cada 30 min |
| GA4 tiempo real | — | — | 1 por minuto con la pestaña abierta (ya existe) |

Si una fuente falla, la ingesta guarda el error en `ingesta`, no reintenta en bucle, y la vista
Medición lo muestra. Al día siguiente vuelve a intentar el día que faltó (la ingesta siempre
pide «los últimos 3 días» para rellenar huecos).

## 6. Vistas del dashboard

| Vista | Contenido |
|---|---|
| **Conversiones** | Indicadores del período con variación · inversión por día apilada por canal · impresiones y clics por día con «hace un año» · mes a mes este año vs anterior (inversión, impresiones, clics) · tabla por campaña ordenable · reparto por canal |
| **Sitio** | Ahora mismo (vivo) · indicadores del período · visitas y conversiones por día con «hace un año» · visitas mes a mes · conversiones por tipo · canales con tasa · fuentes · páginas de entrada |
| **Público** | Radiografía de Meta (edad, género, plataforma, ubicación, región) y del sitio (canales, ciudades, aparato, sistema, páginas), **ahora sí con filtro de fechas** porque viene de la base |
| **Medición** | Salud (filas vivas + manuales) · registro de ingestas (última corrida, filas, errores) · inventario de fuentes |

Filtros globales en la URL (`?desde&hasta&canal&campana`) para que un enlace copiado muestre lo mismo.

## 7. Diseño

Se mantiene el diseño de la v1 (paleta validada, colores con significado: Google azul, Meta
naranja, sitio verde azulado, año anterior gris; verde y rojo solo para mejoró/empeoró; nunca
dos escalas en un gráfico). Cambia la ejecución: gráficos con librería interactiva (cursor,
zoom por arrastre, encender y apagar series) en vez de SVG dibujado a mano.

## 8. Orden de trabajo

| Sprint | Entrega | Qué cambia para Felipe |
|---|---|---|
| 1 | Base creada, esquema, ingesta diaria, carga de la historia, registro en Medición | Nada visible todavía; el panel sigue funcionando como hoy |
| 2 | Las vistas leen de la base; filtros sin recarga; botón «Actualizar hoy» | La página abre al instante y no vuelve a tocar las APIs por mirarla |
| 3 | Gráficos interactivos, candado (`PANEL_CLAVE`), subdominio `panel.valledelsolquillon.cl` | El dashboard final |

## 9. Lo que NO entra (por ahora)

- Eventia (ingresos reales, cierre): Felipe decidió dejarlo fuera el 17-09.
- Términos de búsqueda de Google Ads: necesitan la API propia de Google Ads con token de desarrollador; siguen a mano.
- Pedir el nivel avanzado de la Marketing API: implica verificación del negocio; no hace falta con este presupuesto de llamadas.
