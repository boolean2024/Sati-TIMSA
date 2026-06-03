# SATI-TIMSA

**SATI-TIMSA** (Sistema de Administración de Tecnologías de la Información) es una plataforma web interna diseñada para modernizar y centralizar el control logístico y de inventario del departamento de TI. Su objetivo principal es reemplazar los flujos de trabajo basados en hojas de Excel por un registro único, auditable y accesible desde cualquier navegador.

## 🛠 Arquitectura y Stack Tecnológico
El sistema está diseñado para ser ligero, rápido y fácil de mantener:
*   **Frontend**: HTML, CSS y JavaScript nativo (Vanilla JS). Sin frameworks pesados. El código se minimiza y ofusca para producción.
*   **Backend**: **Node.js** con **Express**. API REST con middlewares de seguridad.
*   **Base de Datos**: **PostgreSQL** + **Supabase Storage** para imágenes.
*   **Infraestructura**: Desplegable en **Vercel** (serverless) o **Render**.

## 📦 Módulos Principales
1.  **Dashboard**: KPIs, gráficas interactivas, alertas de stock bajo y garantías próximas a vencer.
2.  **Inventario de Activos**: Gestión de equipos (laptops, servidores, monitores, etc.) con filtros, fotos, códigos QR y exportación PDF/Excel.
3.  **Inventario de Accesorios**: Control de periféricos (teclados, ratones, cables) asignados a usuarios.
4.  **Control de Stock**: Dispositivos almacenados organizados por ubicación y área.
5.  **Mantenimiento**: Tablero de seguimiento con fases: *Revisado*, *En proceso*, *Terminado*.
6.  **Auditoría**: Registro inmutable de todas las acciones en el sistema.

## 🔐 Seguridad (ISO 27001 / OWASP)

### Autenticación y Sesión
- Cookies **HttpOnly**, **Secure**, **SameSite=Strict** — no accesibles desde JavaScript
- JWT firmado con **secreto de 32+ caracteres**, expiración por defecto **2h**
- **Tiempo absoluto de sesión**: máximo 12h desde el `iat` del token
- **Blacklist de tokens** al hacer logout o cambiar contraseña
- **Recordar sesión**: max 7 días
- Límite de intentos de login: 12 por 15 min
- Rate limiting en recuperación de contraseña: 5 por 15 min

### Contraseñas
- Almacenadas con **bcrypt** (mínimo 10 rounds)
- Largo mínimo: **8 caracteres**, máximo: **128**
- Política de complejidad validada vía Zod en backend

### Protección de Datos
- **CSP** (Content Security Policy) restrictiva con `frameAncestors: none`, `object-src: none`
- **HSTS** preload (1 año, incluyendo subdominios)
- **HTTPS redirect** automático en producción
- **X-Content-Type-Options: nosniff**, **X-Frame-Options: DENY**
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Permissions-Policy**: cámara, micrófono, geolocalización, notificaciones deshabilitadas
- **Cross-Origin-Opener-Policy: same-origin**
- **Cross-Origin-Resource-Policy: same-origin**

### Base de Datos
- **SSL/TLS obligatorio** en producción (`PGSSLMODE=require` o `verify-full`)
- Todos los queries usan **sentencias parametrizadas** (SQL injection prevenido)
- Pool de conexiones con timeouts configurados
- Clasificación de datos por sensibilidad en el schema SQL

### API
- **CSRF protection** via header `X-Requested-With: XMLHttpRequest`
- **CORS** restringido a orígenes configurados
- **Rate limiting** global: 300 requests / 15 min
- **Cache-Control: no-store, private** en todas las rutas API
- Logs sanitizados: headers sensibles filtrados como `[FILTERED]`

### Roles de Usuario
- `ADMIN`: Control total del sistema
- `TI`: CRUD operativo de inventario, stock y mantenimiento
- `PERSONAL`: Solo lectura y consulta

## ⚙️ Herramientas Adicionales
*   **Importación CSV**: Alimentación masiva desde plantilla.
*   **Personalización UI**: Tema claro/oscuro, idioma (ES/EN), densidad visual.
*   **Reportes**: Exportación a PDF, Excel y CSV.
*   **Notificaciones**: Alertas visuales en dashboard.

---
*Nota: Proyecto alineado con normas ISO 27001 y guías OWASP. Auditoría de dependencias: `npm audit`.*