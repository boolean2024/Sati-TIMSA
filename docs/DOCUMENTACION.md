# SATI-TIMSA — Documentación

**Sistema de Administración de Tecnologías de la Información**

Control de activos TI, accesorios, stock, mantenimiento y auditoría para Hutchison Ports TIMSA. Plataforma web que reemplaza el control en Excel por un registro único, consultable y trazable.

---

## Arquitectura

```
Navegador (HTML + CSS + JS vanilla)
       ↕ API REST (fetch + JSON)
   Node.js + Express (backend)
       ↕ SQL parametrizado
    PostgreSQL (Supabase)
```

- **Frontend**: HTML, CSS y JavaScript nativo. Soporte español/inglés con traducción en vivo.
- **Backend**: API REST con JWT, CSRF doble cookie y rate limiting.
- **Base de datos**: PostgreSQL en Supabase. Migraciones automáticas al iniciar.
- **Infraestructura**: Vercel serverless. Despliegue automático en cada push a `main`.

---

## Estructura del proyecto

```
sati-timsa/
├── api/                      Entrada serverless para Vercel
├── backend/src/
│   ├── config/               Configuración y pool de PostgreSQL
│   ├── middleware/            Autenticación JWT, CSRF, manejo de errores
│   ├── routes/               10 módulos (auth, inventory, stock, maintenance, etc.)
│   ├── services/              Auditoría, correo, blacklist de tokens
│   └── scripts/              Creación de admin, ejecutor SQL
├── db/                       Schema, seed y migraciones SQL
├── frontend/                 Archivos públicos (HTML, CSS, JS)
├── private/frontend/         JS fuente antes de minificar/ofuscar
└── scripts/                  Build, backup, test SMTP, relay de impresión
```

---

## Módulos

### Dashboard
KPIs, gráficas interactivas (Chart.js), alertas de stock bajo, garantías próximas a vencer y equipos sin asignar.

### Inventario de activos
Gestión de equipos (laptops, servidores, monitores, proyectores, routers, switches, tablets, teléfonos, UPS, workstations). Cada activo tiene ficha técnica, código de barras CODE128, historial y etiqueta para impresión térmica 50×25 mm. Exportación a PDF/CSV, importación CSV.

### Inventario de accesorios
Periféricos y consumibles (teclados, ratones, cámaras, impresoras, radios, etc.) con control de cantidad. Se almacenan en la misma tabla que los activos pero el sistema los distingue por tipo.

### Control de stock
Dispositivos en almacén organizados por ubicación y área. Vista en tabla y cuadrícula.

### Mantenimiento
Seguimiento por fases: Revisado → En proceso → Terminado. Al marcar como terminado, el equipo vuelve a activo automáticamente.

### Auditoría
Registro inmutable de todas las acciones del sistema. No se puede borrar.

### Cambios recientes
Auditoría con búsqueda, filtros por fecha/usuario/acción, paginación y exportación CSV.

### Usuarios

| Rol | Acceso |
|-----|--------|
| ADMIN | Control total |
| TI | CRUD operativo (inventario, stock, mantenimiento) |
| PERSONAL | Solo lectura |

### Notas y recordatorios
Se crean desde el panel de notificaciones. Persisten en base de datos. Si el servidor no responde, se crean localmente como respaldo.

---

## Seguridad

### Autenticación
- Cookie `sati_session` (HttpOnly, Secure, SameSite=Strict)
- JWT con expiración relativa de 2h, máxima absoluta de 12h
- Blacklist de tokens en DB al cerrar sesión o cambiar contraseña
- Sesión recordada hasta 7 días
- Límite de 12 intentos de login por 15 minutos

### CSRF (doble cookie)
- Cookie `sati_xsrf` + header `x-xsrf-token` obligatorios en POST/PUT/DELETE
- Rutas de autenticación exentas

### Rate limiting

| Límite | Valor | Rutas |
|--------|-------|-------|
| Global | 300 / 15 min | Todas las rutas API |
| Login | 12 / 15 min | `/api/auth/login` |
| Escritura | 100 / 15 min | Equipo, stock, mantenimiento, usuarios, notas |

### Headers HTTP
CSP restrictivo, HSTS (1 año, preload), X-Frame-Options DENY.

### Base de datos
- SQL parametrizado
- SSL/TLS obligatorio en producción
- Check constraints en campos críticos
- Migraciones automáticas al iniciar el servidor

---

## Despliegue

### Requisitos
- Node.js 20+
- PostgreSQL (Supabase)
- Cuenta en Vercel

### Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | Clave de 32+ caracteres |
| `APP_URL` | URL pública de la aplicación |
| `PGSSLMODE` | `require` en producción |

### Comandos

```bash
npm install                # Instalar dependencias
npm run build:frontend     # Minificar y ofuscar JS
npm start                  # Iniciar servidor local (puerto 3000)
vercel --prod              # Desplegar en Vercel
npm run print:relay        # Relay local para impresión Zebra
```

---

## Impresión Zebra

La aplicación está en la nube (Vercel) pero la impresora está en la red local. El botón **Imprimir en Zebra** prueba tres métodos en orden:

1. **Vercel backend** — si el backend alcanza la impresora
2. **Relay local** — servidor Node.js en `localhost:3001` que reenvía a la impresora vía TCP puerto 9100
3. **Descargar ZPL** — como último recurso

```bash
npm run print:relay
```

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| Junio 2026 | Notas y recordatorios persistentes en DB |
| Junio 2026 | Fix: migraciones automáticas en Vercel |
| Junio 2026 | Enter confirma formularios y ejecuta búsquedas |
| Junio 2026 | Traducción en vivo español/inglés |
| Junio 2026 | CSRF doble cookie + blacklist de tokens |
| Junio 2026 | Relay local de impresión Zebra |
| Junio 2026 | Código de barras CODE128 con JsBarcode |
