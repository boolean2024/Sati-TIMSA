# SATI-TIMSA

Sistema de control de activos TI, accesorios, stock, mantenimiento y auditoría para Hutchison Ports TIMSA. Reemplaza el registro en Excel por una plataforma web centralizada, siempre actualizada y accesible desde cualquier navegador.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML, CSS, JavaScript vanilla |
| Backend | Node.js, Express |
| Base de datos | PostgreSQL (Supabase) |
| Infraestructura | Vercel (serverless) |

## Funcionalidades

- **Inventario** — Altas, bajas, edición y búsqueda de equipos y accesorios. Cada activo tiene perfil, código de barras, historial y etiqueta para impresión Zebra.
- **Stock** — Dispositivos en almacén organizados por ubicación y área.
- **Mantenimiento** — Seguimiento por fases: Revisado → En proceso → Terminado. Al finalizar, el equipo vuelve a activo automáticamente.
- **Auditoría** — Registro inmutable de todas las acciones del sistema.
- **Usuarios** — Roles ADMIN, TI y PERSONAL con distintos niveles de acceso.
- **Dashboard** — KPIs, gráficas interactivas, alertas de stock bajo y garantías próximas a vencer.
- **Notas** — Recordatorios persistentes en base de datos.
- **Importación/Exportación** — CSV, PDF, Excel y etiquetas Zebra.

## Local

```bash
npm install
npm run build:frontend
npm start
```

### Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `JWT_SECRET` | Clave de 32+ caracteres |
| `APP_URL` | URL pública de la app |

## Estructura

- `backend/src/routes/` — Endpoints de la API
- `frontend/` — HTML, CSS y JS del navegador
- `private/frontend/` — JS fuente antes de minificar
- `db/` — Schema y migraciones SQL
- `scripts/` — Build, backup, relay de impresión Zebra
