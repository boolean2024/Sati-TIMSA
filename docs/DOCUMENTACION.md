# SATI-TIMSA

SATI-TIMSA es el sistema interno para controlar activos de TI, accesorios, stock, mantenimiento y auditoria. La idea es dejar atras el control en Excel y tener un registro unico, consultable y trazable desde la web.

El proyecto esta pensado para correr en Vercel con PostgreSQL y Storage de Supabase. El frontend es HTML, CSS y JavaScript vanilla; el backend es Node.js con Express.

## Estructura

```text
api/                  Entrada serverless para Vercel
backend/src/          API, rutas, middlewares, servicios y conexion a BD
  config/             Env, pool de PostgreSQL
  middleware/         Auth JWT, CSRF, error handler
  routes/             8 modulos de rutas
  services/           Audit, mail, storage, token blacklist
  scripts/            Creacion de admin, ejecutor SQL
db/                   Schema, seed y migraciones SQL
frontend/             Archivos publicos servidos en produccion
  assets/js/app.min.js  Bundle minificado y ofuscado
private/frontend/     JS fuente antes de minificar/ofuscar
scripts/              Build, backup, test SMTP
docs/DOCUMENTACION.md Este documento
```

## Modulos actuales

- **Consola de inventario**: KPIs, graficas, alertas y resumen general.
- **Inventario de activos**: laptops, monitores, desktops, proyectores, routers, servers, switches, tablets, telefonos, UPS y workstations. Permite filtrar por tipo, marca y modelo.
- **Inventario de accesorios**: perifericos con cantidad, imagen, ubicacion, area, proveedor y usuario.
- **Mantenimiento**: seguimiento por fases. Cuando una orden se marca como terminada, el equipo vuelve al inventario activo y queda el registro en historial.
- **Stock de almacenamiento**: equipos disponibles por ubicacion y area, con cantidades, imagen y vista en cuadricula.
- **Auditoria**: eventos importantes del sistema guardados en PostgreSQL (tabla append-only).
- **Cambios recientes**: vista para revisar auditoria con busqueda, filtros, paginacion y exportacion CSV.
- **Usuarios**: alta de usuarios, roles, bloqueo, reactivacion y reinicio de contrasena para ADMIN.
- **Ajustes**: tema claro/oscuro, idioma, densidad visual, animaciones y filas por pagina.

## Seguridad (ISO 27001 / OWASP)

### Autenticacion

La sesion se maneja con cookie HttpOnly, Secure, SameSite=Strict. No se guarda token en localStorage ni sessionStorage.

El flujo de autenticacion:

1. El usuario envia credenciales a `POST /api/auth/login`
2. El servidor valida con bcrypt, genera un JWT firmado con `JWT_SECRET`
3. El JWT se devuelve en una cookie `sati_session` (HttpOnly, Secure, SameSite=Strict)
4. Cada request valida el JWT en el middleware `authenticate`
5. El token tiene expiracion relativa (2h por defecto, configurable via `JWT_EXPIRES_IN`)
6. **Tiempo absoluto**: maximo 12h desde `iat` (issued at) — no importa el `exp`
7. **Blacklist**: al hacer logout o cambiar contrasena, el token se invalida inmediatamente
8. **Recordar sesion**: cookie con maxAge de 7 dias

### Proteccion CSRF

Toda mutacion (POST, PUT, PATCH, DELETE) requiere el header:

```
X-Requested-With: XMLHttpRequest
```

Las solicitudes multipart (subida de imagenes, CSV) estan exentas porque el navegador bloquea CSRF en uploads mediante CORS preflight.

### Seguridad en transporte

```text
HTTPS redirect:    HTTP → 301 HTTPS (produccion)
HSTS:              max-age=31536000, includeSubDomains, preload
CSP:               default-src 'self', frame-ancestors 'none', object-src 'none'
X-Frame-Options:   DENY
Referrer-Policy:   strict-origin-when-cross-origin
Permissions-Policy: camara, microfono, geolocalizacion = deshabilitados
COOP:              same-origin
CORP:              same-origin
```

### Contraseñas

- Almacenadas con **bcrypt** (minimo 10 rounds, configurable via `BCRYPT_ROUNDS`)
- Largo minimo: **8 caracteres**
- Largo maximo: **128 caracteres** (validado por Zod en backend y frontend)
- Limite de intentos fallidos: 3, luego se habilita opcion de recuperacion
- Recuperacion: codigo de 4 digitos, hash con bcrypt, expira en 10 minutos

### Base de datos

Conexion:

```text
SSL:               Obligatorio en produccion (PGSSLMODE=require o verify-full)
Pool:              max 12 conexiones (1 en Vercel serverless)
Timeouts:          conexion 8s, statement 15s, query 20s, idle 30s
KeepAlive:         habilitado
```

Seguridad en queries:

- 100% sentencias parametrizadas ($1, $2, ...) para prevenir SQL injection
- Transacciones con BEGIN/COMMIT/ROLLBACK para operaciones atomicas
- Clasificacion de datos en schema:
  - PUBLIC: equipment_types, brands, equipment_models, locations
  - INTERNAL: equipment, equipment_history, maintenance_orders, stock_items
  - SENSITIVE: audit_logs
  - RESTRICTED: users (password_hash, reset_code_hash, email)

### Logs

En produccion, el formato Morgan es:

```
:remote-addr :method :url :status :res[content-length] - :response-time ms
```

Los headers sensibles (authorization, cookie, set-cookie) se filtran automaticamente como `[FILTERED]`.

### Validacion de entorno en produccion

Al iniciar, el sistema valida:

- `JWT_SECRET` >= 32 caracteres y diferente de `DATABASE_URL`
- `APP_URL` no contiene `localhost`
- `PGSSLMODE` no es `disable`
- Si `STORAGE_DRIVER=supabase`: requiere `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`

Si alguna validacion falla, el servidor no arranca y muestra todos los errores.

### Roles y permisos

Los permisos se validan en backend, no solo en frontend:

```text
ADMIN     Control completo del sistema, gestion de usuarios
TI        CRUD operativo de inventario, stock y mantenimiento
PERSONAL  Solo lectura y consulta (datos sensibles omitidos)
```

Endpoint de administracion (`/api/users/*`) solo accesible por ADMIN.

### Middleware de seguridad (orden en server.js)

```text
1. HTTPS redirect (produccion)
2. Helmet (security headers)
3. CORS (origenes restringidos)
4. Compression
5. JSON parser (limite 1mb)
6. Morgan (logs sanitizados)
7. Rate limit global (300/15min)
8. Cache-Control: no-store
9. Rate limit login (12/15min)
10. CSRF protection
11. Routes (autenticacion en cada endpoint)
12. Error handler (sin leak de stack traces)
```

## Base de datos

Tablas principales:

```text
users, roles
equipment, equipment_history
equipment_types, brands, equipment_models
locations, areas
maintenance_orders
stock_items
audit_logs
```

Comandos utiles:

```powershell
npm run db:schema
npm run db:seed
npm run admin:create
```

## Variables de produccion

Estas variables se configuran en Vercel o Render:

```text
NODE_ENV=production
APP_URL=https://tu-dominio.vercel.app
DATABASE_URL=postgresql://...
PGSSLMODE=require              # Obligatorio en produccion
JWT_SECRET=valor_largo_y_privado  # Minimo 32 caracteres, unico
BCRYPT_ROUNDS=12

STORAGE_DRIVER=supabase
SUPABASE_URL=https://proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key
SUPABASE_BUCKET=equipment-images

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=correo@gmail.com
SMTP_PASS=contrasena_de_aplicacion
SMTP_FROM=SATI-TIMSA <correo@gmail.com>
```

Para Supabase se usa el connection string del Pooler. En Storage debe existir el bucket indicado en `SUPABASE_BUCKET`.

## Flujo de trabajo

Para trabajar local:

```powershell
npm install
npm run db:schema
npm run db:seed
npm run admin:create
npm run dev
```

Antes de subir cambios:

```powershell
npm run build:frontend
npm run check:all
```

El archivo fuente del frontend es:

```text
private/frontend/app.js
```

Despues de editarlo, generar el bundle publico:

```powershell
npm run build:frontend
```

## Pruebas recomendadas

Antes de desplegar conviene revisar:

```text
Login normal y boton de Entrar
Login con Enter (keyboard submit)
Login fallido (contra incorrecta, 3 intentos)
Recordar sesion (cookie persiste 7d)
Cierre de sesion (cookie eliminada, token blacklisted)
Recuperacion de contrasena por correo
Cambio de contrasena desde ajustes
Crear, editar y eliminar activos
Subir y ampliar imagenes
Finalizar mantenimiento
Consultar stock por area y ubicacion
Exportar PDF, Excel y CSV
Importar CSV desde plantilla
Validar usuario PERSONAL solo lectura
Revisar auditoria y cambios recientes
Validar que CSRF bloquea peticiones sin header
Validar HSTS en respuesta HTTP
Validar redireccion HTTP → HTTPS
Validar que /api/health funciona
```

## Notas de mantenimiento

- No editar directamente `frontend/assets/js/app.min.js`; se genera desde `private/frontend/app.js`.
- Si falla la subida de imagenes en produccion, revisar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` y que el bucket exista.
- Si falla el correo de recuperacion, revisar que Gmail tenga verificacion en dos pasos y contrasena de aplicacion activa.
- Si Vercel muestra error 500, revisar primero variables de entorno y luego `/api/health`.
- Para verificar seguridad: `node --check backend/src/server.js && npm audit --audit-level=high`.
- El sistema esta alineado con ISO 27001 y guias OWASP. Cualquier cambio grande debe probarse en local antes de subirlo a produccion.
