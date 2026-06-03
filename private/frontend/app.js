const settingsStorageKey = 'sati_settings';
const notesStorageKey = 'sati_notes';

function readStoredJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function initialSettings() {
  const saved = readStoredJson(settingsStorageKey, {});
  return Object.prototype.hasOwnProperty.call(saved, 'language') ? saved : { ...saved, language: 'es' };
}

const state = {
  user: null,
  lookups: null,
  items: [],
  inventoryMeta: { page: 1, limit: 25, total: 0, total_pages: 1 },
  dashboard: null,
  dashboardStats: null,
  maintenance: [],
  stock: [],
  stockSummary: { total: 0, available: 0 },
  stockAvailability: [],
  audit: [],
  auditMeta: { page: 1, limit: 50, total: 0, total_pages: 1 },
  recent: [],
  recentMeta: { page: 1, limit: 25, total: 0, total_pages: 1 },
  users: [],
  equipmentProfile: null,
  hardwareGroup: null,
  inventoryDrill: { scope: 'equipment', typeId: '', brandId: '', modelId: '' },
  inventoryScope: 'all',
  viewHistory: [],
  settings: initialSettings(),
  notes: readStoredJson(notesStorageKey, [])
};

const $ = (selector) => document.querySelector(selector);
const loginView = $('#loginView');
const dashboardView = $('#dashboardView');
const inventoryBody = $('#inventoryBody');
const equipmentDialog = $('#equipmentDialog');
const equipmentForm = $('#equipmentForm');
const equipmentPreview = $('#equipmentPreview');
const userDialog = $('#userDialog');
const userForm = $('#userForm');
const passwordDialog = $('#passwordDialog');
const passwordForm = $('#passwordForm');
const catalogDialog = $('#catalogDialog');
const catalogForm = $('#catalogForm');
const catalogFields = $('#catalogFields');
const maintenanceDialog = $('#maintenanceDialog');
const maintenanceForm = $('#maintenanceForm');
const stockDialog = $('#stockDialog');
const stockForm = $('#stockForm');
const resetForm = $('#resetForm');
const settingsDialog = $('#settingsDialog');
const settingsForm = $('#settingsForm');
const notificationPanel = $('#notificationPanel');
const noteForm = $('#noteForm');
const menuButton = $('#menuButton');
const sidebarCollapseButton = $('#sidebarCollapseButton');
let hoverDetailTimer = null;
let hoverHideTimer = null;
let hoverPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let catalogSource = 'equipment';
let catalogContextTarget = null;
let recordContextTarget = null;
let dashboardChartInstances = {};
let dashboardRefreshTimer = null;
const apiBaseUrl = String(window.SATI_API_BASE_URL || '').replace(/\/$/, '');
const joinKey = (...parts) => parts.join('_');
const fieldKeys = {
  au: joinKey('assigned', 'user'),
  cp: joinKey('current', 'password'),
  np: joinKey('new', 'password'),
  rp: joinKey('reset', 'password'),
  pw: ['pass', 'word'].join('')
};
const apiRoute = (...parts) => `/${parts.filter(Boolean).join('/')}`;
const secretResetRoute = (action) => apiRoute('auth', `${fieldKeys.pw}-reset`, action);
const assetTypeNames = [
  'laptop',
  'laptops',
  'monitor',
  'monitores',
  'desktop',
  'destoktop',
  'destoktops',
  'projector',
  'proyector',
  'proyectores',
  'pryector',
  'pryectores',
  'router',
  'routers',
  'server',
  'servers',
  'switch',
  'tablet',
  'tablets',
  'telefono',
  'phone',
  'ups',
  'upc',
  'workstation',
  'workstations',
  'workstacion'
];

const accessoryTypes = [
  'impresora',
  'printer',
  'radio',
  'teclado',
  'camara',
  'mouse',
  'mouses',
  'mause',
  'mauses',
  'maues',
  'maueses',
  'maus',
  'handheld',
  'webcam',
  'audifono',
  'audifonos',
  'auricular',
  'auriculares',
  'diadema',
  'headset',
  'headphones',
  'microfono',
  'bocina',
  'scanner',
  'escaner',
  'lector',
  'cable',
  'cargador',
  'adaptador',
  'dock',
  'docking',
  'hub',
  'nobreak',
  'no-break'
];

const translationPairs = [
  ['Iniciar sesion', 'Sign in'],
  ['Ingrese sus credenciales para acceder al sistema', 'Enter your credentials to access the system'],
  ['Usuario', 'User'],
  ['Contrasena', 'Password'],
  ['Recordarme', 'Remember me'],
  ['Olvido su contrasena?', 'Forgot your password?'],
  ['Entrar', 'Enter'],
  ['Recuperar contrasena', 'Recover password'],
  ['Correo de recuperacion', 'Recovery email'],
  ['Enviar codigo', 'Send code'],
  ['Codigo', 'Code'],
  ['Nueva contrasena', 'New password'],
  ['Cambiar contrasena', 'Change password'],
  ['Maximo 12 caracteres', 'Maximum 12 characters'],
  ['Regresar', 'Back'],
  ['Cerrar', 'Close'],
  ['Cancelar', 'Cancel'],
  ['Guardar', 'Save'],
  ['Guardar ajustes', 'Save settings'],
  ['Restablecer', 'Reset'],
  ['Sistema', 'System'],
  ['Ajustes', 'Settings'],
  ['Tema', 'Theme'],
  ['Claro', 'Light'],
  ['Oscuro', 'Dark'],
  ['Idioma', 'Language'],
  ['Espanol', 'Spanish'],
  ['Densidad', 'Density'],
  ['Comoda', 'Comfortable'],
  ['Compacta', 'Compact'],
  ['Menu lateral', 'Sidebar'],
  ['Expandido', 'Expanded'],
  ['Contraido', 'Collapsed'],
  ['Animaciones', 'Animations'],
  ['Activadas', 'Enabled'],
  ['Reducidas', 'Reduced'],
  ['Filas por pagina', 'Rows per page'],
  ['Consola de inventario', 'Inventory console'],
  ['Resumen general del inventario de activos', 'General asset inventory summary'],
  ['Inventario', 'Inventory'],
  ['Inventario de activos', 'Asset inventory'],
  ['Inventario de equipos', 'Equipment inventory'],
  ['Inventario de accesorios', 'Accessory inventory'],
  ['Equipos en mantenimiento', 'Maintenance equipment'],
  ['Stock de almacenamiento', 'Storage stock'],
  ['Auditoria', 'Audit'],
  ['Cambios recientes', 'Recent changes'],
  ['Usuarios', 'Users'],
  ['Servicios cloud', 'Cloud services'],
  ['Listado general de activos y accesorios registrados', 'General list of registered assets and accessories'],
  ['Dashboard general del inventario de activos', 'General asset inventory dashboard'],
  ['Nuevo activo', 'New asset'],
  ['Nuevo accesorio', 'New accessory'],
  ['Nuevo equipo', 'New equipment'],
  ['Agregar usuario', 'Add user'],
  ['Total', 'Total'],
  ['Activos', 'Active'],
  ['Mantenimiento', 'Maintenance'],
  ['Inactivos', 'Inactive'],
  ['Activos registrados', 'Registered assets'],
  ['Accesorios registrados', 'Registered accessories'],
  ['Equipos registrados', 'Registered equipment'],
  ['En operacion', 'In operation'],
  ['Requieren atencion', 'Need attention'],
  ['Resguardo o baja', 'Assigned hold or retired'],
  ['Total Equipos', 'Total equipment'],
  ['En Mantenimiento', 'In maintenance'],
  ['Alertas de Stock', 'Stock alerts'],
  ['Fases revisado o en proceso', 'Reviewed or in-progress phases'],
  ['TOTAL EQUIPOS', 'TOTAL EQUIPMENT'],
  ['EN MANTENIMIENTO', 'IN MAINTENANCE'],
  ['ALERTAS DE STOCK', 'STOCK ALERTS'],
  ['Items con cantidad menor a 5', 'Items with quantity below 5'],
  ['Tipos', 'Types'],
  ['TIPOS', 'TYPES'],
  ['Distribucion por tipo de equipo', 'Equipment type distribution'],
  ['Areas', 'Areas'],
  ['AREAS', 'AREAS'],
  ['Equipos por area', 'Equipment by area'],
  ['Estado de mantenimiento', 'Maintenance status'],
  ['Estado', 'Status'],
  ['ESTADO', 'STATUS'],
  ['Salud del inventario', 'Inventory health'],
  ['Activos principales', 'Top assets'],
  ['Garantias', 'Warranties'],
  ['Vencimientos', 'Expirations'],
  ['Vencidas', 'Expired'],
  ['Proximos 30 dias', 'Next 30 days'],
  ['Proximos 90 dias', 'Next 90 days'],
  ['Distribucion', 'Distribution'],
  ['Por ubicacion', 'By location'],
  ['Ordenes por fase', 'Orders by phase'],
  ['Almacenamiento', 'Storage'],
  ['Unidades disponibles', 'Available units'],
  ['Registros en stock', 'Stock records'],
  ['Con foto', 'With photo'],
  ['activos', 'assets'],
  ['Equipo audiovisual inventariado.', 'Inventoried audiovisual equipment.'],
  ['Marca registrada para el tipo seleccionado.', 'Brand registered for the selected type.'],
  ['Modelo disponible para la marca seleccionada.', 'Model available for the selected brand.'],
  ['Ver listado', 'View list'],
  ['Abrir', 'Open'],
  ['Sin modelos registrados para esta marca.', 'No models registered for this brand.'],
  ['Sin marcas registradas para este tipo.', 'No brands registered for this type.'],
  ['Sin tipos de activos registrados.', 'No asset types registered.'],
  ['Sin datos por tipo.', 'No data by type.'],
  ['Sin datos por ubicacion.', 'No data by location.'],
  ['Sin ordenes de mantenimiento.', 'No maintenance orders.'],
  ['Buscar inventario', 'Search inventory'],
  ['Buscar por ID, serie, usuario, ubicacion o modelo', 'Search by ID, serial, user, location or model'],
  ['Categoria', 'Category'],
  ['Marca', 'Brand'],
  ['Modelo', 'Model'],
  ['Estado', 'Status'],
  ['Todas', 'All'],
  ['Todos', 'All'],
  ['Exportar PDF', 'Export PDF'],
  ['Exportar Excel', 'Export Excel'],
  ['Plantilla Excel', 'Excel template'],
  ['Importar CSV', 'Import CSV'],
  ['Pagina', 'Page'],
  ['resultados', 'results'],
  ['Tipo', 'Type'],
  ['Numero de serie', 'Serial number'],
  ['ID de inventario', 'Inventory ID'],
  ['Ubicacion', 'Location'],
  ['Area', 'Area'],
  ['Accion', 'Action'],
  ['Evento', 'Event'],
  ['Detalle', 'Detail'],
  ['Nombre', 'Name'],
  ['Correo Gmail', 'Gmail email'],
  ['Rol', 'Role'],
  ['Ver detalle', 'View details'],
  ['Sin ID', 'No ID'],
  ['Sin asignar', 'Unassigned'],
  ['CRUD TI', 'IT CRUD'],
  ['Agregar', 'Add'],
  ['Proveedor', 'Supplier'],
  ['Fecha de compra', 'Purchase date'],
  ['Garantia hasta', 'Warranty until'],
  ['Imagen del equipo', 'Equipment image'],
  ['Notas', 'Notes'],
  ['Eliminar', 'Delete'],
  ['Ficha tecnica', 'Technical sheet'],
  ['QR del activo', 'Asset QR'],
  ['Historial', 'History'],
  ['Foto del equipo', 'Equipment photo'],
  ['Guardar stock', 'Save stock'],
  ['Almacen', 'Warehouse'],
  ['Agregar dispositivo en stock', 'Add stock device'],
  ['Cantidad', 'Quantity'],
  ['Serie', 'Serial'],
  ['Disponibilidad', 'Availability'],
  ['Menor a mayor por ubicacion y area', 'Lowest to highest by location and area'],
  ['Registros consultados', 'Queried records'],
  ['Cantidad disponible', 'Available quantity'],
  ['Agregar mantenimiento', 'Add maintenance'],
  ['Equipo', 'Equipment'],
  ['Revisado', 'Reviewed'],
  ['En proceso', 'In progress'],
  ['Terminado', 'Finished'],
  ['Sin notas registradas.', 'No notes recorded.'],
  ['Sin equipos enviados a mantenimiento.', 'No equipment sent to maintenance.'],
  ['Sin dispositivos en stock para esta consulta.', 'No stock devices for this query.'],
  ['Busqueda', 'Search'],
  ['Desde', 'From'],
  ['Hasta', 'To'],
  ['Filtrar', 'Filter'],
  ['Exportar CSV', 'Export CSV'],
  ['Sin cambios para esta consulta.', 'No changes for this query.'],
  ['Sin eventos de auditoria.', 'No audit events.'],
  ['Contrasena actual', 'Current password'],
  ['Nueva contrasena', 'New password'],
  ['Desactivar', 'Deactivate'],
  ['Activar', 'Activate'],
  ['Sin usuarios.', 'No users.'],
  ['Activo', 'Active'],
  ['Inactivo', 'Inactive'],
  ['Base de datos cloud', 'Cloud database'],
  ['Interfaz operativa', 'Operational interface'],
  ['Editar nombre', 'Edit name'],
  ['Eliminar opcion', 'Delete option'],
  ['Nuevo nombre:', 'New name:'],
  ['Catalogo actualizado.', 'Catalog updated.'],
  ['Catalogo eliminado.', 'Catalog deleted.'],
  ['Seleccione primero una opcion para editarla.', 'Select an option first to edit it.'],
  ['No se puede editar este catalogo.', 'This catalog cannot be edited.'],
  ['Seguro que desea eliminar esta opcion?', 'Are you sure you want to delete this option?'],
  ['Modificar', 'Edit'],
  ['Etiqueta del activo', 'Asset label'],
  ['Imprimir etiqueta', 'Print label'],
  ['Codigo de barras', 'Barcode'],
  ['Etiqueta generada para impresion', 'Label ready for printing'],
  ['Usuario actualizado.', 'User updated.'],
  ['Usuario eliminado.', 'User deleted.'],
  ['Stock eliminado.', 'Stock deleted.'],
  ['Equipo eliminado.', 'Equipment deleted.'],
  ['Seguro que desea eliminar este registro?', 'Are you sure you want to delete this record?'],
  ['Editar usuario', 'Edit user'],
  ['Guardar usuario', 'Save user'],
  ['Actualizar usuario', 'Update user'],
  ['Contrasena inicial', 'Initial password'],
  ['Nueva contrasena opcional', 'Optional new password'],
  ['Abrir enlace', 'Open link'],
  ['No se pudo abrir la ventana de impresion.', 'Could not open the print window.'],
  ['Usuario guardado correctamente.', 'User saved successfully.'],
  ['No puede eliminar su propio usuario.', 'You cannot delete your own user.'],
  ['Seguimiento por fases de revision, proceso y termino', 'Review, process and completion tracking'],
  ['Actualizado', 'Updated'],
  ['Sin proveedor', 'No supplier'],
  ['Sin fecha', 'No date'],
  ['Sin garantia', 'No warranty'],
  ['Actualizado por', 'Updated by'],
  ['Sin comentarios guardados.', 'No saved comments.'],
  ['Sin mantenimiento.', 'No maintenance.'],
  ['Consultar', 'Query'],
  ['PDF generado correctamente.', 'PDF generated successfully.'],
  ['Excel generado correctamente.', 'Excel generated successfully.'],
  ['Cambios recientes exportados.', 'Recent changes exported.'],
  ['Ajustes aplicados correctamente.', 'Settings applied successfully.'],
  ['Contrasena reiniciada.', 'Password reset.']
];

document.body.appendChild(equipmentPreview);

function canWrite() {
  return ['ADMIN', 'TI'].includes(state.user?.role);
}

function isAdmin() {
  return state.user?.role === 'ADMIN';
}

function clearStoredAuth() {
  const legacyKeys = ['sati_token', 'sati_user', 'sati_auth_expires_at', 'sati_auth_remember'];
  [localStorage, sessionStorage].forEach((storage) => {
    legacyKeys.forEach((key) => storage.removeItem(key));
  });
}

async function api(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers || {})
    }
  });

  if (response.status === 204) {
    return null;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    if (response.ok) {
      throw new Error('Respuesta invalida del servidor.');
    }
    payload = {};
  }
  if (!response.ok) {
    throw new Error(payload.message || 'Solicitud fallida. Verifique que la API de produccion este disponible.');
  }
  return payload;
}

function showDashboard() {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  dashboardView.classList.remove('screen-enter');
  void dashboardView.offsetWidth;
  dashboardView.classList.add('screen-enter');
  updateAuthUi();
  applySidebarState();
  renderNotifications();
  setView('console');
}

function updateAuthUi() {
  const writable = canWrite();
  $('#userPill').textContent = state.user?.name || '';
  $('#logoutButton').style.display = 'inline-grid';
  $('#changePasswordButton').style.display = 'inline-grid';
  $('#newEquipmentButton').style.display = writable ? 'inline-flex' : 'none';
  $('#newMaintenanceButton').style.display = writable ? 'inline-flex' : 'none';
  $('#newStockButton').style.display = writable ? 'inline-flex' : 'none';
  $('#downloadTemplateButton').style.display = writable ? 'inline-flex' : 'none';
  $('#importCsvButton').style.display = writable ? 'inline-flex' : 'none';
  $('#exportPdfButton').style.display = writable ? 'inline-flex' : 'none';
  $('#exportExcelButton').style.display = writable ? 'inline-flex' : 'none';
  $('#newUserButton').classList.toggle('hidden', !isAdmin());
  document.querySelectorAll('[data-admin-only]').forEach((element) => {
    element.classList.toggle('hidden', !isAdmin());
  });

  document.querySelectorAll('nav a[data-view]').forEach((link) => {
    link.style.display = '';
  });
}

function applySidebarState() {
  const collapsed = state.settings.sidebar === 'collapsed' || localStorage.getItem('sati_sidebar_collapsed') === 'true';
  dashboardView.classList.toggle('sidebar-collapsed', collapsed);
  menuButton.setAttribute('aria-expanded', String(!collapsed));
  menuButton.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Contraer menu');
  sidebarCollapseButton.setAttribute('aria-label', 'Abrir ajustes');
}

function toggleSidebar() {
  const collapsed = !dashboardView.classList.contains('sidebar-collapsed');
  state.settings.sidebar = collapsed ? 'collapsed' : 'expanded';
  dashboardView.classList.toggle('sidebar-collapsed', collapsed);
  localStorage.setItem('sati_sidebar_collapsed', String(collapsed));
  saveSettingsState();
  applySidebarState();
}

function defaultSettings() {
  return {
    theme: 'light',
    language: 'es',
    density: 'comfortable',
    sidebar: 'expanded',
    motion: 'on',
    pageSize: '25'
  };
}

function normalizedSettings() {
  return { ...defaultSettings(), ...(state.settings || {}) };
}

function saveSettingsState() {
  state.settings = normalizedSettings();
  localStorage.setItem(settingsStorageKey, JSON.stringify(state.settings));
}

function effectiveTheme(settings = normalizedSettings()) {
  if (settings.theme !== 'system') return settings.theme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applySettings() {
  state.settings = normalizedSettings();
  const theme = effectiveTheme(state.settings);
  document.body.dataset.theme = theme;
  document.body.dataset.density = state.settings.density;
  document.body.dataset.motion = state.settings.motion;
  document.documentElement.lang = state.settings.language === 'en' ? 'en' : 'es';
  $('#pageSizeSelect').value = state.settings.pageSize;
  state.inventoryMeta.limit = Number(state.settings.pageSize || 25);
  localStorage.setItem('sati_sidebar_collapsed', String(state.settings.sidebar === 'collapsed'));
  applySidebarState();
  syncSettingsForm();
  updateLanguageLabels();
  if (state.dashboardStats && window.Chart) {
    renderDashboardStats(state.dashboardStats);
  }
}

function syncSettingsForm() {
  if (!settingsForm) return;
  const settings = normalizedSettings();
  settingsForm.elements.theme.value = settings.theme;
  settingsForm.elements.language.value = settings.language;
  settingsForm.elements.density.value = settings.density;
  settingsForm.elements.sidebar.value = settings.sidebar;
  settingsForm.elements.motion.value = settings.motion;
  settingsForm.elements.pageSize.value = settings.pageSize;
}

function openSettingsDialog() {
  $('#settingsMessage').textContent = '';
  syncSettingsForm();
  settingsDialog.showModal();
}

function viewCopy(view) {
  const es = {
    console: ['Consola de inventario', 'Dashboard general del inventario de activos'],
    inventory: ['Inventario', 'Listado general de activos y accesorios registrados'],
    hardware: ['Inventario de activos', 'Laptops, monitores, desktops, red, servidores y movilidad'],
    equipment: ['Inventario de activos', 'Clasificacion por tipo de activo'],
    accessories: ['Inventario de accesorios', 'Perifericos y accesorios asignados o en resguardo'],
    maintenance: ['Equipos en mantenimiento', 'Seguimiento por fases de revision, proceso y termino'],
    stock: ['Stock de almacenamiento', 'Disponibilidad por ubicacion y area'],
    audit: ['Auditoria', 'Eventos recientes y controles del sistema'],
    recent: ['Cambios recientes', 'Actividad completa con filtros, busqueda y paginacion'],
    users: ['Usuarios', 'Alta, roles y seguridad de acceso'],
    cloud: ['Servicios cloud', 'Vercel, Supabase PostgreSQL y Supabase Storage']
  };
  const en = {
    console: ['Inventory console', 'General asset inventory dashboard'],
    inventory: ['Inventory', 'General list of registered assets and accessories'],
    hardware: ['Asset inventory', 'Laptops, monitors, desktops, network, servers and mobility'],
    equipment: ['Asset inventory', 'Classification by asset type'],
    accessories: ['Accessory inventory', 'Assigned or stored peripherals and accessories'],
    maintenance: ['Maintenance equipment', 'Review, process and completion tracking'],
    stock: ['Storage stock', 'Availability by location and area'],
    audit: ['Audit', 'Recent events and system controls'],
    recent: ['Recent changes', 'Full activity with filters, search and pagination'],
    users: ['Users', 'Access creation, roles and security'],
    cloud: ['Cloud services', 'Vercel, Supabase PostgreSQL and Supabase Storage']
  };
  const catalog = normalizedSettings().language === 'en' ? en : es;
  return catalog[view] || catalog.console;
}

function translationMap(language) {
  const map = new Map();
  translationPairs.forEach(([es, en]) => {
    map.set(es, language === 'en' ? en : es);
    map.set(en, language === 'en' ? en : es);
  });
  return map;
}

function uiText(es, en) {
  return normalizedSettings().language === 'en' ? en : es;
}

function translateValue(value, map) {
  const text = String(value ?? '');
  const trimmed = text.trim();
  if (!trimmed) return text;
  const translated = map.get(trimmed);
  if (translated) return text.replace(trimmed, translated);

  const language = normalizedSettings().language === 'en' ? 'en' : 'es';
  const patterns = [
    [/^(\d+) registrados$/i, language === 'en' ? '$1 registered' : '$1 registrados'],
    [/^(\d+) registered$/i, language === 'en' ? '$1 registered' : '$1 registrados'],
    [/^(\d+) activos registrados$/i, language === 'en' ? '$1 registered assets' : '$1 activos registrados'],
    [/^(\d+) registered assets$/i, language === 'en' ? '$1 registered assets' : '$1 activos registrados'],
    [/^(\d+) disponibles$/i, language === 'en' ? '$1 available' : '$1 disponibles'],
    [/^(\d+) available$/i, language === 'en' ? '$1 available' : '$1 disponibles'],
    [/^Mostrando (\d+) resultados$/i, language === 'en' ? 'Showing $1 results' : 'Mostrando $1 resultados'],
    [/^Showing (\d+) results$/i, language === 'en' ? 'Showing $1 results' : 'Mostrando $1 resultados'],
    [/^Pagina (\d+) de (\d+)$/i, language === 'en' ? 'Page $1 of $2' : 'Pagina $1 de $2'],
    [/^Page (\d+) of (\d+)$/i, language === 'en' ? 'Page $1 of $2' : 'Pagina $1 de $2']
  ];
  const match = patterns.find(([pattern]) => pattern.test(trimmed));
  return match ? text.replace(trimmed, trimmed.replace(match[0], match[1])) : text;
}

function translateStaticText() {
  const language = normalizedSettings().language === 'en' ? 'en' : 'es';
  const map = translationMap(language);
  const skipTags = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CANVAS', 'SVG', 'PATH']);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (skipTags.has(node.parentElement?.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    node.nodeValue = translateValue(node.nodeValue, map);
  });
  document.querySelectorAll('[placeholder],[aria-label],[title]').forEach((element) => {
    ['placeholder', 'aria-label', 'title'].forEach((attribute) => {
      if (element.hasAttribute(attribute)) {
        element.setAttribute(attribute, translateValue(element.getAttribute(attribute), map));
      }
    });
  });
}

function updateLanguageLabels() {
  const english = normalizedSettings().language === 'en';
  const navLabels = {
    console: english ? 'Inventory console' : 'Consola de inventario',
    inventory: english ? 'Inventory' : 'Inventario',
    hardware: english ? 'Asset inventory' : 'Inventario de activos',
    equipment: english ? 'Equipment inventory' : 'Inventario de equipos',
    accessories: english ? 'Accessory inventory' : 'Inventario de accesorios',
    maintenance: english ? 'Maintenance' : 'Equipos en mantenimiento',
    stock: english ? 'Storage stock' : 'Stock de almacenamiento',
    audit: english ? 'Audit' : 'Auditoria',
    recent: english ? 'Recent changes' : 'Cambios recientes',
    users: english ? 'Users' : 'Usuarios',
    cloud: english ? 'Cloud services' : 'Servicios cloud'
  };
  document.querySelectorAll('nav a[data-view]').forEach((link) => {
    const icon = link.querySelector('.nav-icon')?.outerHTML || '';
    link.innerHTML = `${icon} ${navLabels[link.dataset.view] || link.dataset.view}`;
  });
  const currentView = dashboardView?.dataset.currentView || 'console';
  const selected = viewCopy(currentView);
  $('#viewTitle').textContent = selected[0];
  $('#viewSubtitle').textContent = selected[1];
  translateStaticText();
}

function setView(view, options = {}) {
  const currentView = dashboardView.dataset.currentView;
  if (!options.fromHistory && currentView && currentView !== view) {
    state.viewHistory.push(currentView);
    state.viewHistory = state.viewHistory.slice(-12);
  }

  if (view === 'accessories') state.inventoryScope = 'accessories';
  if (view === 'equipment') state.inventoryScope = 'equipment';
  if (view === 'inventory') state.inventoryScope = 'all';
  if (view === 'console') state.inventoryScope = 'all';
  if (['hardware', 'equipment', 'accessories'].includes(view)) {
    state.inventoryDrill = {
      scope: view === 'accessories' ? 'accessories' : 'equipment',
      typeId: '',
      brandId: '',
      modelId: ''
    };
  }

  const selected = viewCopy(view);
  dashboardView.dataset.currentView = view;
  syncDashboardRefreshTimer();
  $('.workspace')?.classList.toggle('workspace--console', view === 'console');
  $('#viewTitle').textContent = selected[0];
  $('#viewSubtitle').textContent = selected[1];
  $('#backButton').classList.toggle('hidden', view === 'console');
  $('#newEquipmentButton').innerHTML = `<span class="button-icon">+</span>${view === 'accessories' ? uiText('Nuevo accesorio', 'New accessory') : uiText('Nuevo activo', 'New asset')}`;
  const totalMetricLabel = $('#metricsView article:first-child small');
  if (totalMetricLabel) {
    totalMetricLabel.textContent = view === 'accessories' ? uiText('Accesorios registrados', 'Registered accessories') : uiText('Activos registrados', 'Registered assets');
  }

  const hideDashboardWidgets = view !== 'console';
  $('#metricsView').classList.toggle('hidden', hideDashboardWidgets);
  $('#dashboardKpis').classList.toggle('hidden', hideDashboardWidgets);
  $('#dashboardCharts').classList.toggle('hidden', hideDashboardWidgets);
  $('#dashboardInsights').classList.toggle('hidden', hideDashboardWidgets);
  activatePanel('inventoryView', view === 'inventory');
  activatePanel('hardwareView', ['hardware', 'equipment', 'accessories'].includes(view));
  activatePanel('equipmentView', false);
  activatePanel('maintenanceView', view === 'maintenance');
  activatePanel('stockView', view === 'stock');
  activatePanel('auditView', view === 'audit');
  activatePanel('recentView', view === 'recent');
  activatePanel('usersView', view === 'users');
  activatePanel('cloudView', view === 'cloud');
  hideHoverDetails();

  document.querySelectorAll('nav a[data-view]').forEach((link) => {
    link.classList.toggle('active', link.dataset.view === view);
  });

  syncTypeFilterOptions();
  if (view === 'inventory' && !options.skipLoad) {
    state.inventoryScope = 'all';
    loadInventory();
  }
  if (view === 'console' && !options.skipLoad) {
    loadDashboardIfConsole();
  }
  if (['hardware', 'equipment', 'accessories'].includes(view)) renderHardwareTypeGrid();
  if (view === 'maintenance') {
    renderMaintenanceView();
    loadMaintenance();
  }
  if (view === 'stock') {
    prepareStockFilters();
    loadStock();
  }
  if (view === 'audit') {
    renderAuditView();
    loadAudit();
  }
  if (view === 'recent') {
    renderRecentChangesView();
    loadRecentChanges();
  }
  if (view === 'users') {
    if (!isAdmin()) {
      setView('console');
      return;
    }
    loadUsers();
  }
  translateStaticText();
}

function activatePanel(id, active) {
  const panel = $(`#${id}`);
  panel.classList.toggle('hidden', !active);
  if (!active) return;
  panel.classList.remove('view-panel--enter');
  void panel.offsetWidth;
  panel.classList.add('view-panel--enter');
}

function showLogin() {
  loginView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
  closeOpenDialogs();
  loginView.classList.remove('screen-enter');
  void loginView.offsetWidth;
  loginView.classList.add('screen-enter');
  $('#loginForm').reset();
  const rememberedUsername = localStorage.getItem('sati_remember_username') || '';
  if (rememberedUsername) {
    $('#loginForm').elements.username.value = rememberedUsername;
    $('#loginForm').elements.remember_username.checked = true;
  }
}

async function startSession(credentials, rememberUsername = false) {
  const payload = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      ...credentials,
      remember: rememberUsername
    })
  });
  state.user = payload.user;
  clearStoredAuth();
  if (rememberUsername) {
    localStorage.setItem('sati_remember_username', credentials.username);
  } else {
    localStorage.removeItem('sati_remember_username');
  }
  closeResetPanel();
  showDashboard();
  await loadInitialDashboardData();
}

function closeOpenDialogs() {
  document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
}

function defaultReminderDate() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

async function loadDashboardIfConsole() {
  if (dashboardView.dataset.currentView === 'console') {
    await loadDashboard();
  }
}

function syncDashboardRefreshTimer() {
  clearInterval(dashboardRefreshTimer);
  dashboardRefreshTimer = null;
  if (dashboardView.dataset.currentView !== 'console') return;
  dashboardRefreshTimer = setInterval(() => {
    if (dashboardView.dataset.currentView === 'console' && !dashboardView.classList.contains('hidden')) {
      loadDashboard().catch(() => {});
    }
  }, 30000);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const RAW = Symbol('raw');
function raw(value) { return { [RAW]: true, value: value == null ? '' : String(value) }; }
function esc(strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      const v = values[i];
      if (v && v[RAW]) { result += v.value; }
      else { result += escapeHtml(v); }
    }
  }
  return result;
}

function zoomableImage(src, alt) {
  const safeSrc = escapeHtml(src);
  const safeAlt = escapeHtml(alt || 'Imagen');
  return `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy" data-image-zoom="${safeSrc}" data-image-title="${safeAlt}" title="Ampliar imagen">`;
}

function ensureImageViewer() {
  let viewer = $('#imageViewer');
  if (viewer) return viewer;

  viewer = document.createElement('dialog');
  viewer.id = 'imageViewer';
  viewer.className = 'image-viewer hidden';
  viewer.innerHTML = `
    <div class="image-viewer__backdrop" data-close-image-viewer></div>
    <figure class="image-viewer__content" role="dialog" aria-modal="true" aria-label="Imagen ampliada">
      <button class="icon-button image-viewer__close" type="button" data-close-image-viewer aria-label="Cerrar imagen">x</button>
      <img alt="">
      <figcaption></figcaption>
    </figure>
  `;
  document.body.appendChild(viewer);
  return viewer;
}

function openImageViewer(src, title = 'Imagen') {
  const viewer = ensureImageViewer();
  const image = viewer.querySelector('img');
  const caption = viewer.querySelector('figcaption');
  image.src = src;
  image.alt = title;
  caption.textContent = title;
  viewer.classList.remove('hidden');
  if (typeof viewer.showModal === 'function' && !viewer.open) {
    viewer.showModal();
  }
  document.body.classList.add('image-viewer-open');
  viewer.querySelector('[data-close-image-viewer]')?.focus();
}

function closeImageViewer() {
  const viewer = $('#imageViewer');
  if (!viewer) return;
  if (typeof viewer.close === 'function' && viewer.open) {
    viewer.close();
  }
  viewer.classList.add('hidden');
  viewer.querySelector('img').removeAttribute('src');
  document.body.classList.remove('image-viewer-open');
}

const code128Patterns = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112'
];

function code128Svg(value) {
  const text = String(value || 'SIN-SERIE').slice(0, 48);
  const codes = [104, ...Array.from(text).map((char) => {
    const code = char.charCodeAt(0);
    return code >= 32 && code <= 126 ? code - 32 : 0;
  })];
  const checksum = codes.reduce((sum, code, index) => sum + (index === 0 ? code : code * index), 0) % 103;
  codes.push(checksum, 106);
  let x = 0;
  const bars = [];
  codes.forEach((code) => {
    const pattern = code128Patterns[code] || code128Patterns[0];
    Array.from(pattern).forEach((widthChar, index) => {
      const width = Number(widthChar);
      if (index % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${width}" height="56"></rect>`);
      x += width;
    });
  });
  return `<svg class="asset-barcode" viewBox="0 0 ${x} 56" role="img" aria-label="${uiText('Codigo de barras', 'Barcode')}">${bars.join('')}</svg>`;
}

function assetLabelHtml(profile) {
  const item = profile.item;
  const qr = profile.qr_data_url ? `<img class="asset-label__qr" src="${profile.qr_data_url}" alt="QR">` : '';
  return `
    <section class="asset-label">
      <header><strong>HUTCHISON PORTS TIMSA</strong><span>SATI-TIMSA</span></header>
      <main>
        <div><small>${uiText('Tipo', 'Type')}</small><b>${escapeHtml(item.equipment_type)}</b></div>
        <div><small>${uiText('Modelo', 'Model')}</small><b>${escapeHtml(item.brand)} ${escapeHtml(item.model)}</b></div>
        <div><small>${uiText('Numero de serie', 'Serial number')}</small><b>${escapeHtml(item.serial_number)}</b></div>
        <div><small>${uiText('ID de inventario', 'Inventory ID')}</small><b>${escapeHtml(item.asset_tag || 'Sin ID')}</b></div>
      </main>
      <div class="asset-label__codes">
        <div>${code128Svg(item.serial_number)}<span>${escapeHtml(item.serial_number)}</span></div>
        ${qr}
      </div>
    </section>
  `;
}

function printAssetLabel() {
  if (!state.equipmentProfile?.item) return;
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=720,height=520');
  if (!printWindow) {
    toast(uiText('No se pudo abrir la ventana de impresion.', 'Could not open the print window.'), 'error');
    return;
  }
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${uiText('Etiqueta del activo', 'Asset label')}</title>
        <style>
          @page { size: 90mm 45mm; margin: 4mm; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, sans-serif; color: #071f42; }
          .asset-label { width: 82mm; min-height: 37mm; border: 1px solid #071f42; border-radius: 3mm; padding: 3mm; display: grid; gap: 2mm; }
          header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #d7dee8; padding-bottom: 1.5mm; }
          header strong { font-size: 10pt; }
          header span { font-size: 7pt; font-weight: 700; }
          main { display: grid; grid-template-columns: 1fr 1fr; gap: 1.4mm 3mm; }
          small { display: block; color: #485568; font-size: 5.8pt; text-transform: uppercase; font-weight: 700; }
          b { display: block; font-size: 7.2pt; overflow-wrap: anywhere; }
          .asset-label__codes { display: grid; grid-template-columns: 1fr 18mm; gap: 2mm; align-items: end; }
          .asset-barcode { width: 100%; height: 14mm; fill: #000; }
          .asset-label__codes span { display: block; text-align: center; font-size: 6pt; letter-spacing: 0.08em; }
          .asset-label__qr { width: 18mm; height: 18mm; }
        </style>
      </head>
      <body>${assetLabelHtml(state.equipmentProfile)}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),350)};<\/script></body>
    </html>
  `);
  printWindow.document.close();
  toast(uiText('Etiqueta generada para impresion', 'Label ready for printing'), 'success');
}

function toast(message, type = 'info') {
  let container = $('#toastStack');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastStack';
    container.className = 'toast-stack';
    document.body.appendChild(container);
  }

  const item = document.createElement('div');
  item.className = `toast toast--${type}`;
  item.setAttribute('role', 'status');
  item.textContent = message;
  container.appendChild(item);
  setTimeout(() => item.classList.add('toast--show'), 20);
  setTimeout(() => {
    item.classList.remove('toast--show');
    setTimeout(() => item.remove(), 220);
  }, type === 'error' ? 6500 : 4200);
}

function saveNotes() {
  localStorage.setItem(notesStorageKey, JSON.stringify(state.notes));
}

function renderNotifications() {
  const list = $('#notificationList');
  const count = $('#notificationCount');
  if (!list || !count) return;

  const sortedNotes = [...state.notes].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  count.textContent = sortedNotes.length;
  count.classList.toggle('hidden', sortedNotes.length === 0);

  list.innerHTML = esc(sortedNotes.map((note) => `
    <article class="notification-item">
      <div>
        <strong>${note.text}</strong>
        <span>${raw(formatDate(note.dueAt))}</span>
      </div>
      <footer>
        <span>Agregado por ${note.userName}</span>
        <button class="ghost note-delete" type="button" data-note-delete="${raw(note.id)}">Eliminar</button>
      </footer>
    </article>
  `).join('') || '<p class="empty-module">Sin notas pendientes.</p>');
  translateStaticText();
}

function openNotifications() {
  noteForm.elements.due_at.value = defaultReminderDate();
  notificationPanel.classList.remove('hidden');
  $('#notificationButton').setAttribute('aria-expanded', 'true');
  renderNotifications();
}

function closeNotifications() {
  notificationPanel.classList.add('hidden');
  $('#notificationButton').setAttribute('aria-expanded', 'false');
}

function renderMetrics(totalsOverride = null) {
  const totals = totalsOverride || (
    dashboardView.dataset.currentView === 'console' && state.dashboard?.totals
      ? state.dashboard.totals
      : null
  );
  const total = totals ? Number(totals.total || 0) : state.items.length;
  const active = totals ? Number(totals.active || 0) : state.items.filter((item) => item.status === 'activo').length;
  const maintenance = totals ? Number(totals.maintenance || 0) : state.items.filter((item) => item.status === 'mantenimiento').length;
  const inactive = totals ? Number(totals.inactive || 0) : state.items.filter((item) => ['baja', 'resguardo'].includes(item.status)).length;
  const percentage = (value) => `${total ? Math.round((value / total) * 100) : 0}%`;

  $('#metricTotal').textContent = total;
  $('#metricActive').textContent = active;
  $('#metricMaintenance').textContent = maintenance;
  $('#metricInactive').textContent = inactive;
  $('#metricActivePct').textContent = percentage(active);
  $('#metricMaintenancePct').textContent = percentage(maintenance);
  $('#metricInactivePct').textContent = percentage(inactive);
}

function renderDashboardInsights() {
  const dashboard = state.dashboard;
  if (!dashboard) return;
  const totals = dashboard.totals || {};
  renderMetrics(totals);
  const total = Number(totals.total || 0);
  const statusItems = [
    { label: 'Activos', value: Number(totals.active || 0), className: 'active' },
    { label: 'Mantenimiento', value: Number(totals.maintenance || 0), className: 'maintenance' },
    { label: 'Resguardo o baja', value: Number(totals.inactive || 0), className: 'inactive' }
  ];
  let start = 0;
  const statusColors = {
    active: '#32b66f',
    maintenance: '#f59e0b',
    inactive: '#94a3b8'
  };
  const donutStops = statusItems
    .filter((item) => item.value > 0 && total > 0)
    .map((item) => {
      const degrees = (item.value / total) * 360;
      const stop = `${statusColors[item.className]} ${start}deg ${start + degrees}deg`;
      start += degrees;
      return stop;
    });
  $('#statusDonut').style.background = donutStops.length
    ? `conic-gradient(${donutStops.join(', ')})`
    : 'conic-gradient(#e5e7eb 0deg 360deg)';
  $('#statusDonutTotal').textContent = total;
  $('#statusLegend').innerHTML = statusItems.map((item) => esc`
    <div><i class="${raw(item.className)}"></i><span>${item.label}</span><strong>${item.value}</strong></div>
  `).join('');

  const warranty = dashboard.warranty || {};
  $('#warrantyInsights').innerHTML = esc`
    <div><strong>${warranty.expired || 0}</strong><span>Vencidas</span></div>
    <div><strong>${warranty.next_30 || 0}</strong><span>Proximos 30 dias</span></div>
    <div><strong>${warranty.next_90 || 0}</strong><span>Proximos 90 dias</span></div>
  `;

  const maxType = Math.max(1, ...(dashboard.by_type || []).map((item) => Number(item.total)));
  $('#typeInsights').innerHTML = esc((dashboard.by_type || []).map((item) => `
    <div class="insight-bar">
      <span>${item.equipment_type}</span>
      <strong>${item.total}</strong>
      <i data-width="${raw(Math.max(6, Math.round((Number(item.total) / maxType) * 100)))}"></i>
    </div>
  `).join('') || '<p class="empty-module">Sin datos por tipo.</p>');

  const maxLocation = Math.max(1, ...(dashboard.by_location || []).map((item) => Number(item.total)));
  $('#locationInsights').innerHTML = esc((dashboard.by_location || []).map((item) => `
    <div class="insight-bar">
      <span>${item.location}</span>
      <strong>${item.total}</strong>
      <i data-width="${raw(Math.max(6, Math.round((Number(item.total) / maxLocation) * 100)))}"></i>
    </div>
  `).join('') || '<p class="empty-module">Sin datos por ubicacion.</p>');

  const maxMaintenance = Math.max(1, ...(dashboard.maintenance || []).map((item) => Number(item.total)));
  $('#maintenanceInsights').innerHTML = esc((dashboard.maintenance || []).map((item) => `
    <div class="insight-bar">
      <span>${raw(phaseLabel(item.phase))}</span>
      <strong>${item.total}</strong>
      <i data-width="${raw(Math.max(6, Math.round((Number(item.total) / maxMaintenance) * 100)))}"></i>
    </div>
  `).join('') || '<p class="empty-module">Sin ordenes de mantenimiento.</p>');

  const stock = dashboard.stock || {};
  $('#stockInsights').innerHTML = esc`
    <div><strong>${stock.total_quantity || 0}</strong><span>Unidades disponibles</span></div>
    <div><strong>${stock.total_items || 0}</strong><span>Registros en stock</span></div>
    <div><strong>${stock.with_images || 0}</strong><span>Con foto</span></div>
  `;

  document.querySelectorAll('#dashboardInsights i[data-width]').forEach((bar) => {
    bar.style.width = `${bar.dataset.width}%`;
  });
  translateStaticText();
}

function chartColors(count, alert = false) {
  const palette = alert
    ? ['#0b4f8f', '#64748b', '#2fb66d', '#ef4444', '#38bdf8', '#94a3b8']
    : ['#0b4f8f', '#179bd7', '#64748b', '#2fb66d', '#94a3b8', '#113c75', '#60a5fa', '#16a34a'];
  return Array.from({ length: count }, (_, index) => palette[index % palette.length]);
}

function destroyDashboardCharts() {
  Object.values(dashboardChartInstances).forEach((chart) => chart?.destroy?.());
  dashboardChartInstances = {};
}

function renderDashboardStats(stats) {
  const kpis = stats?.kpis || {};
  $('#kpiTotalEquipos').textContent = kpis.totalEquipos || 0;
  $('#kpiMantenimiento').textContent = kpis.equiposEnMantenimiento || 0;
  $('#kpiAlertasStock').textContent = kpis.alertasStock || 0;

  if (!window.Chart) {
    console.error('Chart.js no esta disponible.');
    return;
  }

  destroyDashboardCharts();

  const tipos = stats.equiposPorTipo || [];
  const areas = stats.equiposPorArea || [];
  const mantenimiento = stats.estadoMantenimiento || [];
  const darkTheme = document.body.dataset.theme === 'dark';
  const chartText = darkTheme ? '#d5dfeb' : '#334155';
  const chartMuted = darkTheme ? '#93a4ba' : '#64748b';
  const chartGrid = darkTheme ? 'rgba(125, 165, 214, 0.18)' : '#e5e7eb';
  const chartBorder = darkTheme ? '#0f1e32' : '#ffffff';
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: chartText, boxWidth: 12 } }
    }
  };

  dashboardChartInstances.tipos = new Chart($('#chartTipos'), {
    type: 'doughnut',
    data: {
      labels: tipos.map((item) => item.tipo),
      datasets: [{
        data: tipos.map((item) => Number(item.total || 0)),
        backgroundColor: chartColors(tipos.length),
        borderColor: chartBorder,
        borderWidth: 2
      }]
    },
    options: {
      ...baseOptions,
      cutout: '62%'
    }
  });

  dashboardChartInstances.areas = new Chart($('#chartAreas'), {
    type: 'bar',
    data: {
      labels: areas.map((item) => item.area),
      datasets: [{
        label: uiText('Equipos', 'Equipment'),
        data: areas.map((item) => Number(item.total || 0)),
        backgroundColor: '#179bd7',
        borderRadius: 6
      }]
    },
    options: {
      ...baseOptions,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0, color: chartMuted }, grid: { color: chartGrid } },
        y: { ticks: { color: chartText }, grid: { display: false } }
      }
    }
  });

  dashboardChartInstances.mantenimiento = new Chart($('#chartMantenimiento'), {
    type: 'bar',
    data: {
      labels: mantenimiento.map((item) => phaseLabel(item.fase)),
      datasets: [{
        label: uiText('Equipos', 'Equipment'),
        data: mantenimiento.map((item) => Number(item.total || 0)),
        backgroundColor: chartColors(mantenimiento.length, true),
        borderRadius: 6
      }]
    },
    options: {
      ...baseOptions,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: chartText }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0, color: chartMuted }, grid: { color: chartGrid } }
      }
    }
  });
  translateStaticText();
}

async function loadDashboardStats() {
  try {
      const response = await fetch(`${apiBaseUrl}/api/dashboard/stats`, {
      credentials: 'include'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || 'No se pudieron cargar las estadisticas del dashboard.');
    }
    state.dashboardStats = payload;
    renderDashboardStats(payload);
  } catch (error) {
    console.error('Error cargando estadisticas del dashboard:', error);
    toast('No se pudieron cargar las graficas del dashboard.', 'error');
  }
}

function normalizeTypeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

function normalizeText(value) {
  return normalizeTypeName(value).replace(/-/g, ' ');
}

function isAccessoryType(type) {
  return accessoryTypes.includes(normalizeTypeName(type));
}

function isAssetType(type) {
  return assetTypeNames.includes(normalizeTypeName(type));
}

function isAccessoryItem(item) {
  const type = item?.equipment_type || item?.name;
  return isAccessoryType(type) || !isAssetType(type);
}

function selectedEquipmentTypeName() {
  const typeId = Number(equipmentForm.elements.equipment_type_id.value);
  return state.lookups?.types.find((type) => Number(type.id) === typeId)?.name || '';
}

function isAccessoryFormMode() {
  return state.inventoryScope === 'accessories' || isAccessoryType(selectedEquipmentTypeName());
}

function syncEquipmentFormMode() {
  const accessoryMode = isAccessoryFormMode();
  document.querySelectorAll('#equipmentForm .asset-only-field').forEach((field) => {
    field.classList.toggle('hidden', accessoryMode);
  });
  document.querySelectorAll('#equipmentForm .accessory-only-field').forEach((field) => {
    field.classList.toggle('hidden', !accessoryMode);
  });

  equipmentForm.elements.status.required = !accessoryMode;
  equipmentForm.elements.purchase_date.disabled = accessoryMode;
  equipmentForm.elements.warranty_until.disabled = accessoryMode;
  equipmentForm.elements.asset_tag.disabled = accessoryMode;
  if (accessoryMode) {
    equipmentForm.elements.status.value = 'activo';
    equipmentForm.elements.purchase_date.value = '';
    equipmentForm.elements.warranty_until.value = '';
    equipmentForm.elements.asset_tag.value = '';
  }
}

function visibleTypesForScope(types) {
  if (state.inventoryScope === 'accessories') {
    return types.filter((item) => isAccessoryType(item.name));
  }
  if (state.inventoryScope === 'equipment') {
    return types.filter((item) => isAssetType(item.name));
  }
  return types;
}

function displayStatus(value) {
  return String(value || '').replace(/^\w/, (letter) => letter.toUpperCase());
}

function productSymbol(type) {
  const value = normalizeTypeName(type);
  if (value.includes('laptop')) return 'laptop';
  if (value.includes('desktop')) return 'desktop';
  if (value.includes('monitor')) return 'monitor';
  if (value.includes('telefono') || value.includes('phone') || value.includes('handheld')) return 'phone';
  if (value.includes('tablet')) return 'tablet';
  if (value.includes('radio')) return 'radio';
  if (value.includes('camara') || value.includes('camera') || value.includes('webcam')) return 'camera';
  if (value.includes('mouse') || value.includes('mause') || value.includes('maues') || value.includes('maus')) return 'mouse';
  if (value.includes('teclado') || value.includes('keyboard')) return 'keyboard';
  if (value.includes('impresora')) return 'printer';
  if (value.includes('audifono') || value.includes('auricular') || value.includes('diadema') || value.includes('headset') || value.includes('headphone')) return 'headphones';
  if (value.includes('router')) return 'router';
  if (value.includes('switch')) return 'switch';
  if (value.includes('server')) return 'server';
  if (value.includes('projector') || value.includes('proyector') || value.includes('pryector')) return 'projector';
  if (value.includes('ups') || value.includes('upc')) return 'ups';
  if (value.includes('workstation') || value.includes('workstacion')) return 'workstation';
  if (value.includes('api')) return 'api';
  if (value.includes('db') || value.includes('postgres')) return 'database';
  if (value.includes('web') || value.includes('frontend')) return 'web';
  return 'equipment';
}

function productIcon(type, size = 'sm') {
  const symbol = productSymbol(type);
  const icons = {
    laptop: '<path d="M7 8h18v11H7z"/><path d="M4 22h24l-2 3H6z"/>',
    desktop: '<path d="M6 7h20v14H6z"/><path d="M14 24h4"/><path d="M12 27h8"/>',
    monitor: '<path d="M5 7h22v14H5z"/><path d="M16 21v5"/><path d="M11 26h10"/>',
    phone: '<path d="M11 4h10v24H11z"/><path d="M15 7h2"/><path d="M15 25h2"/>',
    radio: '<path d="M9 12h16v14H9z"/><path d="M13 9l8-5"/><path d="M13 17h8"/><circle cx="15" cy="22" r="2"/>',
    camera: '<path d="M7 10h5l2-3h5l2 3h4v14H7z"/><circle cx="16" cy="17" r="4"/><path d="M22 13h1"/>',
    mouse: '<path d="M11 4h10v24H11z"/><path d="M16 4v7"/><path d="M11 13h10"/>',
    keyboard: '<path d="M4 10h24v14H4z"/><path d="M8 14h2M13 14h2M18 14h2M23 14h2M8 19h12M23 19h2"/>',
    printer: '<path d="M9 4h14v8H9z"/><path d="M7 13h18a3 3 0 0 1 3 3v7h-5v5H9v-5H4v-7a3 3 0 0 1 3-3z"/><path d="M11 22h10"/>',
    headphones: '<path d="M7 18v-2a9 9 0 0 1 18 0v2"/><path d="M7 18h5v8H7z"/><path d="M20 18h5v8h-5z"/>',
    router: '<path d="M7 16h18v8H7z"/><path d="M11 16l-3-7M21 16l3-7"/><path d="M11 20h1M16 20h1M21 20h1"/>',
    switch: '<path d="M5 10h22v14H5z"/><path d="M9 15h3M15 15h3M21 15h3M9 20h3M15 20h3M21 20h3"/>',
    server: '<path d="M8 5h16v8H8z"/><path d="M8 19h16v8H8z"/><path d="M12 9h.01M12 23h.01M16 9h4M16 23h4"/>',
    projector: '<path d="M6 12h15a5 5 0 0 1 0 10H6z"/><circle cx="21" cy="17" r="3"/><path d="M9 22l-2 5M18 22l2 5"/>',
    tablet: '<rect x="9" y="4" width="14" height="24" rx="2"/><path d="M15 25h2"/>',
    ups: '<path d="M9 5h14v22H9z"/><path d="M13 10h6M13 15h6"/><circle cx="16" cy="22" r="2"/>',
    workstation: '<path d="M5 7h22v13H5z"/><path d="M11 25h10"/><path d="M16 20v5"/><path d="M9 11h14"/>',
    database: '<ellipse cx="16" cy="7" rx="9" ry="3"/><path d="M7 7v14c0 1.7 4 3 9 3s9-1.3 9-3V7"/><path d="M7 14c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    api: '<path d="M9 10l-5 6 5 6"/><path d="M23 10l5 6-5 6"/><path d="M19 7l-6 18"/>',
    web: '<circle cx="16" cy="16" r="11"/><path d="M5 16h22"/><path d="M16 5c3 3 4 7 4 11s-1 8-4 11"/><path d="M16 5c-3 3-4 7-4 11s1 8 4 11"/>',
    equipment: '<path d="M7 8h18v16H7z"/><path d="M12 13h8"/><path d="M12 18h5"/>'
  };

  return `
    <span class="product-icon product-icon--${size} product-icon--${symbol}" aria-hidden="true">
      <svg viewBox="0 0 32 32" focusable="false">
        ${icons[symbol] || icons.equipment}
      </svg>
    </span>
  `;
}

function equipmentMedia(item, size = 'sm') {
  if (item?.image_path) {
    return `
      <span class="equipment-photo equipment-photo--${size}">
        ${zoomableImage(equipmentImageUrl(item), `Imagen de ${item.serial_number}`)}
      </span>
    `;
  }
  return productIcon(item?.equipment_type, size);
}

function stockMedia(item, size = 'sm') {
  if (item?.image_path) {
    return `
      <span class="equipment-photo equipment-photo--${size}">
        ${zoomableImage(stockImageUrl(item), `Foto de ${item.name}`)}
      </span>
    `;
  }
  return productIcon(item?.name, size);
}

function imageVersionQuery(item) {
  const params = new URLSearchParams();
  if (item?.id) params.set('id', item.id);
  if (item?.updated_at) params.set('v', item.updated_at);
  return params.toString();
}

function equipmentImageUrl(item) {
  const query = imageVersionQuery(item);
  return `${apiBaseUrl}/api/equipment/${item.id}/image/view${query ? `?${query}` : ''}`;
}

function stockImageUrl(item) {
  const query = imageVersionQuery(item);
  return `${apiBaseUrl}/api/stock/${item.id}/image/view${query ? `?${query}` : ''}`;
}

function uiIcon(name) {
  const icons = {
    more: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/>',
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-5"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>'
  };

  return `
    <span class="ui-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        ${icons[name] || icons.more}
      </svg>
    </span>
  `;
}

function renderPreview(item) {
  if (!item) {
    hideHoverDetails();
    return;
  }

  equipmentPreview.classList.remove('hidden');
  equipmentPreview.innerHTML = esc`
    <div class="hover-detail-header">
      <div>
        <span class="eyebrow">Detalles completos</span>
        <h3>${item.brand} ${item.model}</h3>
      </div>
      <button class="icon-button detail-close" type="button" data-close-preview aria-label="Cerrar">x</button>
    </div>
    <div class="detail-hero">
      <div class="equipment-art">${raw(equipmentMedia(item, 'lg'))}</div>
      <div class="detail-identity">
        <span class="detail-type">${item.equipment_type}</span>
        <strong>${item.asset_tag || item.serial_number}</strong>
        <span class="status ${item.status}">${raw(displayStatus(item.status))}</span>
      </div>
    </div>
    <div class="detail-grid">
      <article>
        <span>ID</span>
        <strong>${item.id}</strong>
      </article>
      <article>
        <span>ID de inventario</span>
        <strong>${item.asset_tag || 'Sin ID'}</strong>
      </article>
      <article>
        <span>Nombre de usuario</span>
        <strong>${item[fieldKeys.au] || 'Sin asignar'}</strong>
      </article>
      <article>
        <span>Numero de serie</span>
        <strong>${item.serial_number}</strong>
      </article>
      ${raw(isAccessoryItem(item) ? esc`
        <article>
          <span>Cantidad</span>
          <strong>${Number(item.quantity ?? 1)}</strong>
        </article>
      ` : '')}
      <article>
        <span>Ubicacion</span>
        <strong>${item.location}</strong>
      </article>
      <article>
        <span>Area</span>
        <strong>${item.area}</strong>
      </article>
    </div>
    <div class="detail-footer">
      <span>Actualizado ${raw(formatDate(item.updated_at))}</span>
      <span id="hoverDetailNav" class="inline-links"></span>
    </div>
  `;
}

function renderStockPreview(item) {
  if (!item) {
    hideHoverDetails();
    return;
  }

  const canWrite = ['ADMIN', 'TI'].includes(state.user?.role);
  equipmentPreview.classList.remove('hidden');
  equipmentPreview.innerHTML = esc`
    <div class="hover-detail-header">
      <div>
        <span class="eyebrow">Detalles de stock</span>
        <h3>${item.name}</h3>
      </div>
      <button class="icon-button detail-close" type="button" data-close-preview aria-label="Cerrar">x</button>
    </div>
    <div class="detail-hero">
      <div class="equipment-art">${raw(stockMedia(item, 'lg'))}</div>
      <div class="detail-identity">
        <span class="detail-type">Stock de almacenamiento</span>
        <strong>${item.item_code || item.serial_number || item.name}</strong>
        <span class="status activo">${raw(Number(item.quantity || 0))} disponibles</span>
      </div>
    </div>
    <div class="detail-grid">
      <article><span>ID</span><strong>${item.item_code || 'Sin ID'}</strong></article>
      <article><span>Modelo</span><strong>${item.model}</strong></article>
      <article><span>Numero de serie</span><strong>${item.serial_number || 'Sin serie'}</strong></article>
      <article><span>Ubicacion</span><strong>${item.location}</strong></article>
      <article><span>Area</span><strong>${item.area}</strong></article>
      <article><span>Cantidad</span><strong>${raw(Number(item.quantity || 0))}</strong></article>
    </div>
    <div class="detail-footer">
      <span>Actualizado ${raw(formatDate(item.updated_at))}</span>
      ${raw(canWrite ? esc`<button class="ghost icon-label" type="button" data-stock-preview-edit="${item.id}">${raw(uiIcon('eye'))}Modificar</button>` : '')}
    </div>
  `;
}

function positionHoverDetails() {
  equipmentPreview.removeAttribute('style');
}

function showHoverDetails(item) {
  clearTimeout(hoverHideTimer);
  renderPreview(item);
  positionHoverDetails();
  equipmentPreview.classList.add('equipment-preview--visible');
}

function scheduleHoverDetails(item, event) {
  clearTimeout(hoverDetailTimer);
  clearTimeout(hoverHideTimer);
  hoverPointer = { x: event.clientX, y: event.clientY };
  hoverDetailTimer = setTimeout(() => showHoverDetails(item), 1000);
}

function hideHoverDetails(delay = 0) {
  clearTimeout(hoverDetailTimer);
  clearTimeout(hoverHideTimer);

  if (delay > 0) {
    hoverHideTimer = setTimeout(() => hideHoverDetails(), delay);
    return;
  }

  equipmentPreview.classList.remove('equipment-preview--visible');
  hoverHideTimer = setTimeout(() => {
    if (!equipmentPreview.classList.contains('equipment-preview--visible')) {
      equipmentPreview.classList.add('hidden');
      equipmentPreview.innerHTML = '';
      equipmentPreview.removeAttribute('style');
    }
  }, 160);
}

function renderInventory() {
  inventoryBody.innerHTML = '';
  $('#emptyState').classList.toggle('hidden', state.items.length > 0);
  const meta = state.inventoryMeta || { page: 1, limit: 25, total: state.items.length, total_pages: 1 };
  const first = meta.total === 0 ? 0 : ((meta.page - 1) * meta.limit) + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);
  $('#resultCount').textContent = normalizedSettings().language === 'en'
    ? `Showing ${first}-${last} of ${meta.total} results`
    : `Mostrando ${first}-${last} de ${meta.total} resultados`;
  $('#pageIndicator').textContent = normalizedSettings().language === 'en'
    ? `Page ${meta.page} of ${meta.total_pages}`
    : `Pagina ${meta.page} de ${meta.total_pages}`;
  $('#prevPageButton').disabled = meta.page <= 1;
  $('#nextPageButton').disabled = meta.page >= meta.total_pages;

  state.items.forEach((item, index) => {
    const row = document.createElement('tr');
    row.dataset.itemId = item.id;
    row.classList.add('inventory-row');
    row.classList.add(`inventory-row-delay-${Math.min(index, 15)}`);
    row.innerHTML = esc`
      <td data-label="ID"><strong>${String(item.id).slice(0, 8)}</strong></td>
      <td data-label="Tipo">
        <div class="device-cell">
          ${raw(equipmentMedia(item))}
          <strong>${item.equipment_type}</strong>
        </div>
      </td>
      <td data-label="Marca">${item.brand}</td>
      <td data-label="Modelo">${item.model}</td>
      <td data-label="Numero de serie" data-hover-detail><strong>${item.serial_number}</strong></td>
      <td data-label="ID de inventario">${item.asset_tag || 'Sin ID'}</td>
      <td data-label="Ubicacion">${item.location}</td>
      <td data-label="Area">${item.area}</td>
      <td data-label="Usuario">${item[fieldKeys.au] || 'Sin asignar'}</td>
      <td data-label="Accion"><button class="ghost row-action" data-edit="${raw(item.id)}" aria-label="Ver detalle">${raw(uiIcon('more'))}</button></td>
    `;
    inventoryBody.appendChild(row);
  });

  hideHoverDetails();
  renderEquipmentTypeList();
  renderHardwareTypeGrid();
  renderAuditView();
  translateStaticText();
}

function renderEquipmentTypeList() {
  const container = $('#equipmentTypeList');
  if (!container) return;
  const totals = state.items.filter((item) => isAssetType(item.equipment_type)).reduce((acc, item) => {
    acc[item.equipment_type] = (acc[item.equipment_type] || 0) + 1;
    return acc;
  }, {});

  container.innerHTML = esc(Object.entries(totals)
    .map(([type, total]) => `
      <article>
        ${raw(productIcon(type, 'md'))}
        <div>
          <strong>${type}</strong>
          <p>${raw(total)} activos registrados</p>
        </div>
      </article>
    `)
    .join('') || '<p class="empty-module">Sin equipos para clasificar.</p>');
}

function typeDescription(typeName, total) {
  const normalized = normalizeText(typeName);
  const descriptions = [
    [['laptop', 'laptops'], uiText('Equipos portatiles asignados a usuarios y areas.', 'Portable equipment assigned to users and areas.')],
    [['monitor', 'monitores'], uiText('Pantallas asignadas a estaciones de trabajo.', 'Screens assigned to workstations.')],
    [['desktop', 'destoktop', 'desktop'], uiText('Estaciones fijas en operacion.', 'Fixed stations in operation.')],
    [['projector', 'proyector', 'proyectores'], uiText('Equipo audiovisual inventariado.', 'Inventoried audiovisual equipment.')],
    [['router', 'routers'], uiText('Red y conectividad por area.', 'Network and connectivity by area.')],
    [['server', 'servers'], uiText('Infraestructura critica de TI.', 'Critical IT infrastructure.')],
    [['switch'], uiText('Equipo de comunicacion y red.', 'Communication and network equipment.')],
    [['tablet', 'tablets'], uiText('Dispositivos moviles operativos.', 'Operational mobile devices.')],
    [['telefono', 'phone'], uiText('Telefonia asignada a usuarios o areas.', 'Telephony assigned to users or areas.')],
    [['ups', 'upc'], uiText('Respaldo electrico inventariado.', 'Inventoried power backup.')],
    [['workstation', 'workstacion'], uiText('Equipos de alto rendimiento.', 'High performance equipment.')]
  ];
  const match = descriptions.find(([keys]) => keys.some((key) => normalized.includes(key)));
  return match?.[1] || uiText(`${total} registros disponibles en inventario.`, `${total} records available in inventory.`);
}

function typePreviewMedia(typeName) {
  return productIcon(typeName, 'md');
}

function renderHardwareTypeGrid() {
  const container = $('#hardwareTypeGrid');
  if (!container) return;
  const drill = state.inventoryDrill || { scope: 'equipment', typeId: '', brandId: '', modelId: '' };
  const links = state.lookups?.type_brand_models || [];
  const scopedItems = state.items.filter((item) => drill.scope === 'accessories' ? isAccessoryType(item.equipment_type) : isAssetType(item.equipment_type));
  const selectedType = state.lookups?.types.find((type) => String(type.id) === String(drill.typeId));

  if (drill.typeId && drill.brandId) {
    const models = state.lookups.models
      .filter((model) => Number(model.brand_id) === Number(drill.brandId))
      .filter((model) => links.some((link) => Number(link.equipment_type_id) === Number(drill.typeId) && Number(link.brand_id) === Number(drill.brandId) && Number(link.model_id) === Number(model.id)))
      .map((model) => ({
        ...model,
        total: scopedItems.filter((item) => item.model === model.name && (!selectedType || item.equipment_type === selectedType.name)).length
      }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'));

    container.innerHTML = models.map((model) => `
      <article class="hardware-option" data-drill-model-id="${model.id}" data-catalog-kind="models" data-catalog-id="${model.id}" data-catalog-name="${escapeHtml(model.name)}" role="button" tabindex="0">
        ${productIcon('model', 'md')}
        <div>
          <strong>${escapeHtml(model.name)}</strong>
          <p>Modelo disponible para la marca seleccionada.</p>
          <small>${model.total} registrados</small>
        </div>
        <button class="ghost" type="button" tabindex="-1">Ver listado</button>
      </article>
    `).join('') || '<p class="empty-module">Sin modelos registrados para esta marca.</p>';
    translateStaticText();
    return;
  }

  if (drill.typeId) {
    const brands = state.lookups.brands
      .filter((brand) => links.some((link) => Number(link.equipment_type_id) === Number(drill.typeId) && Number(link.brand_id) === Number(brand.id)))
      .map((brand) => ({
        ...brand,
        total: scopedItems.filter((item) => item.brand === brand.name && (!selectedType || item.equipment_type === selectedType.name)).length
      }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'));

    container.innerHTML = brands.map((brand) => `
      <article class="hardware-option" data-drill-brand-id="${brand.id}" data-catalog-kind="brands" data-catalog-id="${brand.id}" data-catalog-name="${escapeHtml(brand.name)}" role="button" tabindex="0">
        ${productIcon('brand', 'md')}
        <div>
          <strong>${escapeHtml(brand.name)}</strong>
          <p>Marca registrada para el tipo seleccionado.</p>
          <small>${brand.total} registrados</small>
        </div>
        <button class="ghost" type="button" tabindex="-1">Abrir</button>
      </article>
    `).join('') || '<p class="empty-module">Sin marcas registradas para este tipo.</p>';
    translateStaticText();
    return;
  }

  const types = (state.lookups?.types || [])
    .filter((type) => drill.scope === 'accessories' ? isAccessoryType(type.name) : isAssetType(type.name))
    .map((type) => {
      const total = scopedItems.filter((item) => normalizeText(item.equipment_type) === normalizeText(type.name)).length;
      return { ...type, total };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'));

  container.innerHTML = types.map((type) => `
    <article class="hardware-option" data-drill-type-id="${type.id}" data-catalog-kind="types" data-catalog-id="${type.id}" data-catalog-name="${escapeHtml(type.name)}" role="button" tabindex="0">
      ${typePreviewMedia(type.name)}
      <div>
        <strong>${escapeHtml(type.name)}</strong>
        <p>${escapeHtml(typeDescription(type.name, type.total))}</p>
        <small>${type.total} registrados</small>
      </div>
      <button class="ghost" type="button" tabindex="-1">Abrir</button>
    </article>
  `).join('') || '<p class="empty-module">Sin tipos de activos registrados.</p>';
  translateStaticText();
}

function renderAuditView() {
  const body = $('#auditBody');
  if (!body) return;
  body.innerHTML = esc(state.audit.map((event) => `
    <tr>
      <td><span class="audit-event">${raw(uiIcon('shield'))}${event.action}</span></td>
      <td>${event.entity} ${event.entity_id || ''}<br><small>${event.username || event.user_name || 'Sistema'} &middot; ${raw(formatDate(event.created_at))}</small></td>
      <td><span class="status activo">OK</span></td>
    </tr>
  `).join('') || '<tr><td colspan="3">Sin eventos de auditoria.</td></tr>');
  const meta = state.auditMeta || {};
  $('#auditResultCount').textContent = normalizedSettings().language === 'en'
    ? `Showing ${state.audit.length} of ${meta.total || state.audit.length} events`
    : `Mostrando ${state.audit.length} de ${meta.total || state.audit.length} eventos`;
  translateStaticText();
}

function auditSummary(event) {
  const metadata = event.metadata || {};
  const parts = [
    metadata.serial_number || metadata.item_code || metadata.asset_tag || event.entity_id,
    metadata.name || metadata.model || metadata.status || metadata.phase,
    metadata.reason || metadata.note || metadata.notes
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Movimiento registrado en el sistema';
}

function actionLabel(action) {
  return {
    CREATE: 'Creacion',
    UPDATE: 'Actualizacion',
    DELETE: 'Eliminacion',
    IMAGE_UPLOAD: 'Imagen',
    LOGIN: 'Acceso'
  }[action] || action;
}

function renderRecentChangesView() {
  const list = $('#recentChangesList');
  if (!list) return;
  const meta = state.recentMeta || { page: 1, total_pages: 1, total: 0 };
  list.innerHTML = state.recent.map((event) => `
    <article class="recent-card">
      <div class="recent-card__icon">${uiIcon(event.action === 'DELETE' ? 'trash' : 'shield')}</div>
      <div>
        <header>
          <strong>${escapeHtml(actionLabel(event.action))}</strong>
          <span>${escapeHtml(event.entity)}${event.entity_id ? ` · ${escapeHtml(event.entity_id)}` : ''}</span>
        </header>
        <p>${escapeHtml(auditSummary(event))}</p>
        <footer>
          <span>${escapeHtml(event.username || event.user_name || 'Sistema')}</span>
          <span>${formatDate(event.created_at)}</span>
          ${event.ip_address ? `<span>${escapeHtml(event.ip_address)}</span>` : ''}
        </footer>
      </div>
    </article>
  `).join('') || '<p class="empty-module">Sin cambios para esta consulta.</p>';
  $('#recentResultCount').textContent = normalizedSettings().language === 'en'
    ? `Showing ${state.recent.length} of ${meta.total || 0} changes`
    : `Mostrando ${state.recent.length} de ${meta.total || 0} cambios`;
  $('#recentPageIndicator').textContent = normalizedSettings().language === 'en'
    ? `Page ${meta.page || 1} of ${meta.total_pages || 1}`
    : `Pagina ${meta.page || 1} de ${meta.total_pages || 1}`;
  $('#prevRecentPageButton').disabled = Number(meta.page || 1) <= 1;
  $('#nextRecentPageButton').disabled = Number(meta.page || 1) >= Number(meta.total_pages || 1);
  translateStaticText();
}

function phasePercent(phase) {
  return { revisado: 33, en_proceso: 66, terminado: 100 }[phase] || 0;
}

function phaseLabel(phase) {
  return {
    revisado: 'Revisado',
    'en proceso': 'En proceso',
    en_proceso: 'En proceso',
    terminado: 'Terminado'
  }[phase] || phase;
}

function renderMaintenanceView() {
  const summary = $('#maintenanceSummary');
  const list = $('#maintenanceList');
  if (!summary || !list) return;

  const counts = {
    revisado: state.maintenance.filter((item) => item.phase === 'revisado').length,
    en_proceso: state.maintenance.filter((item) => item.phase === 'en_proceso').length,
    terminado: state.maintenance.filter((item) => item.phase === 'terminado').length
  };

  summary.innerHTML = `
    <article><span>Revisado</span><strong>${counts.revisado}</strong></article>
    <article><span>En proceso</span><strong>${counts.en_proceso}</strong></article>
    <article><span>Terminado</span><strong>${counts.terminado}</strong></article>
  `;

  list.innerHTML = esc(state.maintenance.map((item) => {
    const percent = phasePercent(item.phase);
    const canWrite = ['ADMIN', 'TI'].includes(state.user?.role);
    return `
      <article class="maintenance-card">
        <header>
          <div>
            <span>${item.equipment_type}</span>
            <h3>${item.serial_number} · ${item.brand} ${item.model}</h3>
          </div>
          ${raw(canWrite ? esc`<button class="ghost" type="button" data-maintenance-edit="${raw(item.id)}">Actualizar</button>` : '')}
        </header>
        <div class="phase-track" aria-label="${raw('Avance ' + percent + '%')}">
          <div class="phase-bar phase-${raw(percent)}"></div>
        </div>
        <div class="phase-steps">
          <span class="${raw(percent >= 33 ? 'active' : '')}">Revisado</span>
          <span class="${raw(percent >= 66 ? 'active' : '')}">En proceso</span>
          <span class="${raw(percent >= 100 ? 'active' : '')}">Terminado</span>
        </div>
        <p>${item.notes || 'Sin notas registradas.'}</p>
        <footer>
          <div class="maintenance-meta">
            <span>${raw(phaseLabel(item.phase))} · ${raw(percent)}%</span>
            <span>${item.location} / ${item.area}</span>
            <span>Actualizado ${raw(formatDate(item.updated_at))}</span>
          </div>
        </footer>
      </article>
    `;
  }).join('') || '<p class="empty-module">Sin equipos enviados a mantenimiento.</p>');
  translateStaticText();
}

function renderStockView() {
  const summary = $('#stockSummary');
  const availability = $('#stockAvailability');
  const list = $('#stockList');
  if (!summary || !availability || !list) return;
  const canWrite = ['ADMIN', 'TI'].includes(state.user?.role);
  summary.innerHTML = `
    <article><span>Registros consultados</span><strong>${state.stockSummary.total || state.stock.length}</strong></article>
    <article><span>Cantidad disponible</span><strong>${state.stockSummary.available || 0}</strong></article>
  `;
  availability.innerHTML = esc`
    <header>
      <div>
        <span class="eyebrow">Disponibilidad</span>
        <strong>Menor a mayor por ubicacion y area</strong>
      </div>
    </header>
    <div class="availability-grid">
      ${raw((state.stockAvailability || []).map((item) => esc`
        <article>
          <span>${item.location}</span>
          <strong>${raw(item.available)}</strong>
          <small>${item.area} / ${raw(item.total)} total</small>
        </article>
      `).join('') || '<p class="empty-module">Sin disponibilidad para esta consulta.</p>')}
    </div>
  `;
  list.innerHTML = esc(state.stock.map((item) => `
    <article class="stock-card" data-stock-id="${raw(item.id)}">
      <header>
        <div class="stock-title">
          ${raw(stockMedia(item))}
          <div>
            <span>${item.item_code || item.serial_number || 'Sin ID'}</span>
            <h3>${item.name}</h3>
          </div>
        </div>
        <div class="stock-actions">
          <strong class="quantity-pill">${raw(Number(item.quantity || 0))} disponibles</strong>
          ${raw(canWrite ? esc`<button class="ghost" type="button" data-stock-edit="${raw(item.id)}">Modificar</button>` : '')}
        </div>
      </header>
      <div class="stock-meta">
        <div><span>Ubicacion</span><strong>${item.location}</strong></div>
        <div><span>Area</span><strong>${item.area}</strong></div>
        <div><span>Modelo</span><strong>${item.model}</strong></div>
      </div>
      <p>${item.notes || 'Pase el cursor para ver detalles completos.'}</p>
    </article>
  `).join('') || '<p class="empty-module">Sin dispositivos en stock para esta consulta.</p>');
  translateStaticText();
}

async function loadLookups() {
  const currentType = equipmentForm.elements.equipment_type_id.value;
  const currentBrand = equipmentForm.elements.brand_id.value;
  const currentModel = equipmentForm.elements.model_id.value;
  const currentLocation = equipmentForm.elements.location_id.value;
  state.lookups = await api('/lookups');
  fillSelect('equipment_type_id', state.lookups.types);
  if (currentType && state.lookups.types.some((type) => String(type.id) === String(currentType))) {
    equipmentForm.elements.equipment_type_id.value = currentType;
  }
  syncTypeFilterOptions();
  syncBrandOptions({ preserve: true });
  if (currentBrand && Array.from(equipmentForm.elements.brand_id.options).some((option) => option.value === currentBrand)) {
    equipmentForm.elements.brand_id.value = currentBrand;
  }
  syncModelOptions({ preserve: true });
  if (currentModel && Array.from(equipmentForm.elements.model_id.options).some((option) => option.value === currentModel)) {
    equipmentForm.elements.model_id.value = currentModel;
  }
  fillSelect('location_id', inventoryLocations());
  if (currentLocation && inventoryLocations().some((location) => String(location.id) === String(currentLocation))) {
    equipmentForm.elements.location_id.value = currentLocation;
  }
  if (stockForm) fillElementSelect(stockForm.elements.location_id, inventoryLocations(), 'Seleccionar');
  syncAreaOptions();
  syncStockAreaOptions();
  syncEquipmentFormMode();
  renderSupplierOptions();
}

function syncTypeFilterOptions() {
  if (!state.lookups) return;
  const currentValue = $('#typeFilter')?.value || '';
  const types = visibleTypesForScope(state.lookups.types);
  fillSelect('typeFilter', types, 'Todas');
  if (types.some((item) => String(item.id) === String(currentValue))) {
    $('#typeFilter').value = currentValue;
  }
  syncInventoryBrandFilterOptions();
  syncInventoryModelFilterOptions();
}

function syncInventoryBrandFilterOptions() {
  if (!state.lookups || !$('#brandFilter')) return;
  const currentValue = $('#brandFilter').value;
  const typeId = Number($('#typeFilter').value);
  const links = state.lookups.type_brand_models || [];
  const allowed = typeId
    ? new Set(links.filter((link) => Number(link.equipment_type_id) === typeId).map((link) => Number(link.brand_id)))
    : new Set();
  const brands = allowed.size
    ? state.lookups.brands.filter((brand) => allowed.has(Number(brand.id)))
    : state.lookups.brands;
  fillSelect('brandFilter', brands, 'Todas');
  if (brands.some((brand) => String(brand.id) === String(currentValue))) {
    $('#brandFilter').value = currentValue;
  }
}

function syncInventoryModelFilterOptions() {
  if (!state.lookups || !$('#modelFilter')) return;
  const currentValue = $('#modelFilter').value;
  const typeId = Number($('#typeFilter').value);
  const brandId = Number($('#brandFilter').value);
  const links = state.lookups.type_brand_models || [];
  const allowed = typeId
    ? new Set(links.filter((link) => Number(link.equipment_type_id) === typeId && (!brandId || Number(link.brand_id) === brandId)).map((link) => Number(link.model_id)).filter(Boolean))
    : new Set();
  let models = brandId ? state.lookups.models.filter((model) => Number(model.brand_id) === brandId) : state.lookups.models;
  if (allowed.size) {
    models = models.filter((model) => allowed.has(Number(model.id)));
  }
  fillSelect('modelFilter', models, 'Todos');
  if (models.some((model) => String(model.id) === String(currentValue))) {
    $('#modelFilter').value = currentValue;
  }
}

function fillSelect(name, items, emptyLabel = 'Seleccionar') {
  const select = equipmentForm.elements[name] || stockForm?.elements[name] || $(`#${name}`);
  select.innerHTML = `<option value="">${emptyLabel}</option>`;
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    option.dataset.catalogId = item.id;
    option.dataset.catalogName = item.name;
    select.appendChild(option);
  }
}

function fillElementSelect(select, items, emptyLabel = 'Todos') {
  if (!select) return;
  select.innerHTML = `<option value="">${emptyLabel}</option>`;
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    option.dataset.catalogId = item.id;
    option.dataset.catalogName = item.name;
    select.appendChild(option);
  }
}

function ensureCatalogContextMenu() {
  let menu = $('#catalogContextMenu');
  if (menu) return menu;

  menu = document.createElement('div');
  menu.id = 'catalogContextMenu';
  menu.className = 'catalog-context-menu hidden';
  menu.innerHTML = `
    <button type="button" data-catalog-action="edit">${uiText('Modificar', 'Edit')}</button>
    <button type="button" data-catalog-action="delete">${uiText('Eliminar', 'Delete')}</button>
  `;
  document.body.appendChild(menu);
  return menu;
}

function ensureRecordContextMenu() {
  let menu = $('#recordContextMenu');
  if (menu) return menu;

  menu = document.createElement('div');
  menu.id = 'recordContextMenu';
  menu.className = 'catalog-context-menu hidden';
  menu.innerHTML = `
    <button type="button" data-record-action="edit">${uiText('Modificar', 'Edit')}</button>
    <button type="button" data-record-action="delete">${uiText('Eliminar', 'Delete')}</button>
  `;
  document.body.appendChild(menu);
  return menu;
}

function catalogKindFromSelect(select) {
  const key = select?.name || select?.id || '';
  const aliases = {
    equipment_type_id: 'types',
    typeFilter: 'types',
    brand_id: 'brands',
    brandFilter: 'brands',
    model_id: 'models',
    modelFilter: 'models',
    location_id: 'locations',
    stockLocationFilter: 'locations',
    area_id: 'areas',
    stockAreaFilter: 'areas'
  };
  return aliases[key] || '';
}

function catalogTargetFromEvent(event) {
  const card = event.target.closest?.('[data-catalog-kind][data-catalog-id]');
  if (card) {
    return {
      kind: card.dataset.catalogKind,
      id: card.dataset.catalogId,
      name: card.dataset.catalogName || card.querySelector('strong')?.textContent?.trim() || ''
    };
  }

  const select = event.target.closest?.('select');
  const kind = catalogKindFromSelect(select);
  const option = select?.options?.[select.selectedIndex];
  if (!kind || !select?.value || !option) return null;
  return {
    kind,
    id: select.value,
    name: option.dataset.catalogName || option.textContent.trim()
  };
}

function openCatalogContextMenu(event, target) {
  if (!canWrite() || !target?.kind || !target?.id) return;
  event.preventDefault();
  event.stopPropagation();
  catalogContextTarget = target;
  const menu = ensureCatalogContextMenu();
  menu.querySelector('[data-catalog-action="edit"]').textContent = uiText('Modificar', 'Edit');
  menu.querySelector('[data-catalog-action="delete"]').textContent = uiText('Eliminar', 'Delete');
  menu.classList.remove('hidden');
  menu.style.left = '0px';
  menu.style.top = '0px';
  const rect = menu.getBoundingClientRect();
  const left = Math.min(event.clientX, window.innerWidth - rect.width - 10);
  const top = Math.min(event.clientY, window.innerHeight - rect.height - 10);
  menu.style.left = `${Math.max(10, left)}px`;
  menu.style.top = `${Math.max(10, top)}px`;
}

function closeCatalogContextMenu() {
  const menu = $('#catalogContextMenu');
  if (menu) menu.classList.add('hidden');
  catalogContextTarget = null;
}

function recordTargetFromEvent(event) {
  const userCard = event.target.closest?.('[data-user-id]');
  if (userCard) return { kind: 'user', id: userCard.dataset.userId };
  const stockCard = event.target.closest?.('[data-stock-id]');
  if (stockCard) return { kind: 'stock', id: stockCard.dataset.stockId };
  const equipmentRow = event.target.closest?.('tr[data-item-id]');
  if (equipmentRow) return { kind: 'equipment', id: equipmentRow.dataset.itemId };
  return null;
}

function openRecordContextMenu(event, target) {
  if (!target?.id) return;
  if (target.kind !== 'user' && !canWrite()) return;
  if (target.kind === 'user' && !isAdmin()) return;
  event.preventDefault();
  event.stopPropagation();
  closeCatalogContextMenu();
  recordContextTarget = target;
  const menu = ensureRecordContextMenu();
  menu.querySelector('[data-record-action="edit"]').textContent = uiText('Modificar', 'Edit');
  menu.querySelector('[data-record-action="delete"]').textContent = uiText('Eliminar', 'Delete');
  menu.classList.remove('hidden');
  menu.style.left = '0px';
  menu.style.top = '0px';
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(10, Math.min(event.clientX, window.innerWidth - rect.width - 10))}px`;
  menu.style.top = `${Math.max(10, Math.min(event.clientY, window.innerHeight - rect.height - 10))}px`;
}

function closeRecordContextMenu() {
  const menu = $('#recordContextMenu');
  if (menu) menu.classList.add('hidden');
  recordContextTarget = null;
}

async function editRecordTarget() {
  const target = recordContextTarget;
  closeRecordContextMenu();
  if (!target) return;
  if (target.kind === 'equipment') {
    const item = state.items.find((entry) => entry.id === target.id);
    if (item) openEquipment(item);
  }
  if (target.kind === 'stock') {
    const item = state.stock.find((entry) => entry.id === target.id);
    if (item) openStockDialog(item);
  }
  if (target.kind === 'user') {
    const user = state.users.find((entry) => entry.id === target.id);
    if (user) openUserDialog(user);
  }
}

async function deleteRecordTarget() {
  const target = recordContextTarget;
  closeRecordContextMenu();
  if (!target || !confirm(uiText('Seguro que desea eliminar este registro?', 'Are you sure you want to delete this record?'))) return;
  if (target.kind === 'equipment') {
    await api(`/equipment/${target.id}`, { method: 'DELETE' });
    await loadInventory();
    await loadDashboardIfConsole();
    toast(uiText('Equipo eliminado.', 'Equipment deleted.'), 'success');
  }
  if (target.kind === 'stock') {
    await api(`/stock/${target.id}`, { method: 'DELETE' });
    await loadStock();
    await loadDashboardIfConsole();
    toast(uiText('Stock eliminado.', 'Stock deleted.'), 'success');
  }
  if (target.kind === 'user') {
    await deleteUser(target.id);
  }
}

function resetInvalidInventoryDrill() {
  const drill = state.inventoryDrill || {};
  if (drill.typeId && !state.lookups.types.some((type) => String(type.id) === String(drill.typeId))) {
    state.inventoryDrill = { scope: drill.scope || state.inventoryScope, typeId: '', brandId: '', modelId: '' };
    return;
  }
  if (drill.brandId && !state.lookups.brands.some((brand) => String(brand.id) === String(drill.brandId))) {
    state.inventoryDrill.brandId = '';
    state.inventoryDrill.modelId = '';
  }
  if (drill.modelId && !state.lookups.models.some((model) => String(model.id) === String(drill.modelId))) {
    state.inventoryDrill.modelId = '';
  }
}

async function refreshAfterCatalogMutation() {
  const currentView = dashboardView.dataset.currentView || 'console';
  await loadLookups();
  resetInvalidInventoryDrill();
  await loadInventory();
  if (currentView === 'console') await loadDashboard();
  if (currentView === 'stock') {
    prepareStockFilters();
    await loadStock();
  }
  if (currentView === 'maintenance') await loadMaintenance();
  if (['hardware', 'equipment', 'accessories'].includes(currentView)) renderHardwareTypeGrid();
}

async function editCatalogTarget() {
  const target = catalogContextTarget;
  closeCatalogContextMenu();
  if (!target) return;
  const nextName = window.prompt(uiText('Nuevo nombre:', 'New name:'), target.name);
  if (nextName === null) return;
  const name = nextName.trim();
  if (!name || name === target.name) return;
  await api(`/lookups/${target.kind}/${encodeURIComponent(target.id)}`, {
    method: 'PUT',
    body: JSON.stringify({ name })
  });
  await refreshAfterCatalogMutation();
  toast(uiText('Catalogo actualizado.', 'Catalog updated.'), 'success');
}

async function deleteCatalogTarget() {
  const target = catalogContextTarget;
  closeCatalogContextMenu();
  if (!target) return;
  const confirmed = window.confirm(`${uiText('Seguro que desea eliminar esta opcion?', 'Are you sure you want to delete this option?')}\n${target.name}`);
  if (!confirmed) return;
  await api(`/lookups/${target.kind}/${encodeURIComponent(target.id)}`, {
    method: 'DELETE'
  });
  await refreshAfterCatalogMutation();
  toast(uiText('Catalogo eliminado.', 'Catalog deleted.'), 'success');
}

function catalogLinksForSelectedType() {
  const typeId = Number(equipmentForm.elements.equipment_type_id.value);
  if (!typeId || !state.lookups?.type_brand_models) return [];
  return state.lookups.type_brand_models.filter((link) => Number(link.equipment_type_id) === typeId);
}

function syncBrandOptions({ preserve = true } = {}) {
  if (!state.lookups) return;
  const current = preserve ? equipmentForm.elements.brand_id.value : '';
  const links = catalogLinksForSelectedType();
  const allowedBrandIds = new Set(links.map((link) => Number(link.brand_id)).filter(Boolean));
  const brands = allowedBrandIds.size
    ? state.lookups.brands.filter((brand) => allowedBrandIds.has(Number(brand.id)))
    : state.lookups.brands;

  fillElementSelect(equipmentForm.elements.brand_id, brands, 'Seleccionar');
  if (current && brands.some((brand) => String(brand.id) === String(current))) {
    equipmentForm.elements.brand_id.value = current;
  }
}

function syncModelOptions({ preserve = true } = {}) {
  if (!state.lookups) return;
  const current = preserve ? equipmentForm.elements.model_id.value : '';
  const brandId = Number(equipmentForm.elements.brand_id.value);
  const links = catalogLinksForSelectedType();
  const allowedModelIds = new Set(links.map((link) => Number(link.model_id)).filter(Boolean));
  let models = state.lookups.models;

  if (brandId) {
    models = models.filter((model) => Number(model.brand_id) === brandId);
  }
  if (allowedModelIds.size) {
    models = models.filter((model) => allowedModelIds.has(Number(model.id)));
  }

  fillElementSelect(equipmentForm.elements.model_id, models, 'Seleccionar');
  if (current && models.some((model) => String(model.id) === String(current))) {
    equipmentForm.elements.model_id.value = current;
  }
}

function renderAssignedUserOptions() {
  const datalist = $('#assignedUsersList');
  if (!datalist) return;
  const users = [...new Set(state.items.map((item) => item[fieldKeys.au]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
  datalist.innerHTML = users.map((user) => `<option value="${escapeHtml(user)}"></option>`).join('');
}

function renderSupplierOptions() {
  const datalist = $('#supplierList');
  if (!datalist) return;
  const suppliers = [
    ...(state.lookups?.suppliers || []).map((supplier) => supplier.name),
    ...state.items.map((item) => item.supplier)
  ]
    .filter(Boolean)
    .map((supplier) => String(supplier).trim())
    .filter(Boolean);
  const uniqueSuppliers = [...new Set(suppliers)].sort((a, b) => a.localeCompare(b, 'es'));
  datalist.innerHTML = uniqueSuppliers.map((supplier) => `<option value="${escapeHtml(supplier)}"></option>`).join('');
}

function syncAreaOptions() {
  if (!state.lookups) return;
  const locationId = Number(equipmentForm.elements.location_id.value);
  const areas = state.lookups.areas.filter((area) => !locationId || Number(area.location_id) === locationId);
  const current = equipmentForm.elements.area_id.value;
  fillElementSelect(equipmentForm.elements.area_id, areas, 'Seleccionar');
  if (current && areas.some((area) => String(area.id) === String(current))) {
    equipmentForm.elements.area_id.value = current;
  }
}

function syncStockAreaOptions() {
  if (!state.lookups || !stockForm) return;
  const locationId = Number(stockForm.elements.location_id.value);
  const areas = state.lookups.areas.filter((area) => !locationId || Number(area.location_id) === locationId);
  const current = stockForm.elements.area_id.value;
  fillElementSelect(stockForm.elements.area_id, areas, 'Seleccionar');
  stockForm.elements.area_id.value = current;
}

function syncStockFilterAreas() {
  if (!state.lookups) return;
  const locationId = Number($('#stockLocationFilter').value);
  const areas = state.lookups.areas.filter((area) => !locationId || Number(area.location_id) === locationId);
  fillElementSelect($('#stockAreaFilter'), areas, 'Todas');
}

function prepareStockFilters() {
  if (!state.lookups) return;
  fillElementSelect($('#stockLocationFilter'), inventoryLocations(), 'Todas');
  syncStockFilterAreas();
}

async function loadInventory() {
  const search = encodeURIComponent($('#searchInput').value.trim());
  const typeId = encodeURIComponent($('#typeFilter').value);
  const brandId = encodeURIComponent($('#brandFilter')?.value || '');
  const modelId = encodeURIComponent($('#modelFilter')?.value || '');
  const status = encodeURIComponent($('#statusFilter').value);
  const page = state.inventoryMeta.page || 1;
  const limit = Number($('#pageSizeSelect').value || state.inventoryMeta.limit || 25);
  const scope = state.inventoryScope === 'all' ? '' : `&scope=${encodeURIComponent(state.inventoryScope)}`;
  const payload = await api(`/equipment?search=${search}&type_id=${typeId}&brand_id=${brandId}&model_id=${modelId}&status=${status}&page=${page}&limit=${limit}${scope}`);
  state.items = payload.items;
  state.inventoryMeta = payload.meta || { page: 1, limit, total: state.items.length, total_pages: 1 };
  renderMetrics();
  renderInventory();
  renderAssignedUserOptions();
  renderSupplierOptions();
}

async function loadDashboard() {
  state.dashboard = await api('/dashboard');
  renderDashboardInsights();
  await loadDashboardStats();
}

async function loadAudit() {
  if (!['ADMIN', 'TI'].includes(state.user?.role)) {
    state.audit = [];
    state.auditMeta = { page: 1, limit: 50, total: 0, total_pages: 1 };
    renderAuditView();
    return;
  }
  const params = new URLSearchParams({
    limit: '50',
    page: '1',
    username: $('#auditUsernameFilter')?.value.trim() || '',
    action: $('#auditActionFilter')?.value.trim() || '',
    entity: $('#auditEntityFilter')?.value.trim() || '',
    date_from: $('#auditFromFilter')?.value || '',
    date_to: $('#auditToFilter')?.value || ''
  });
  const payload = await api(`/audit?${params.toString()}`);
  state.audit = payload.items || [];
  state.auditMeta = payload.meta || { page: 1, limit: 50, total: state.audit.length, total_pages: 1 };
  renderAuditView();
}

async function loadRecentChanges() {
  if (!['ADMIN', 'TI'].includes(state.user?.role)) {
    state.recent = [];
    state.recentMeta = { page: 1, limit: 25, total: 0, total_pages: 1 };
    renderRecentChangesView();
    return;
  }
  const params = new URLSearchParams({
    limit: $('#recentPageSizeSelect')?.value || String(state.recentMeta.limit || 25),
    page: String(state.recentMeta.page || 1),
    search: $('#recentSearchFilter')?.value.trim() || '',
    username: $('#recentUsernameFilter')?.value.trim() || '',
    action: $('#recentActionFilter')?.value.trim() || '',
    entity: $('#recentEntityFilter')?.value.trim() || '',
    date_from: $('#recentFromFilter')?.value || '',
    date_to: $('#recentToFilter')?.value || ''
  });
  const payload = await api(`/audit?${params.toString()}`);
  state.recent = payload.items || [];
  state.recentMeta = payload.meta || { page: 1, limit: 25, total: state.recent.length, total_pages: 1 };
  renderRecentChangesView();
}

async function loadMaintenance() {
  const payload = await api('/maintenance');
  state.maintenance = payload.items;
  renderMaintenanceView();
}

async function loadStock() {
  const params = new URLSearchParams({
    search: $('#stockSearchInput')?.value.trim() || '',
    location_id: $('#stockLocationFilter')?.value || '',
    area_id: $('#stockAreaFilter')?.value || ''
  });
  const payload = await api(`/stock?${params.toString()}`);
  state.stock = payload.items || [];
  state.stockSummary = payload.summary || { total: state.stock.length, available: 0 };
  state.stockAvailability = payload.availability || [];
  renderStockView();
}

async function loadEquipmentProfile(id) {
  if (!id) {
    state.equipmentProfile = null;
    $('#equipmentProfilePanel').classList.add('hidden');
    return;
  }
  const payload = await api(`/equipment/${id}`);
  state.equipmentProfile = payload;
  renderEquipmentProfile(payload);
}

function historyAssignmentText(entry) {
  if (entry.event_type === 'MAINTENANCE_COMPLETED') {
    return 'Equipo reparado y regresado a activo';
  }
  const current = entry[fieldKeys.au] || entry.new_data?.[fieldKeys.au] || '';
  const previous = entry[joinKey('previous', 'assigned', 'user')] || entry.previous_data?.[fieldKeys.au] || '';
  if (current && previous && current !== previous) {
    return `Asignado a: ${current} (antes: ${previous})`;
  }
  if (current) {
    return `Asignado a: ${current}`;
  }
  if (previous) {
    return `Sin usuario asignado (antes: ${previous})`;
  }
  return 'Sin usuario asignado';
}

function historyCommentText(entry) {
  if (entry.event_type === 'MAINTENANCE_COMPLETED') {
    const notes = String(entry.new_data?.notes || '').trim();
    return notes ? `Reparado: ${notes}` : 'Equipo reparado.';
  }
  const current = String(entry.new_data?.notes || '').trim();
  const previous = String(entry.previous_data?.notes || '').trim();
  if (!current) return '';
  if (entry.event_type === 'CREATED' || current !== previous) return current;
  return '';
}

function renderEquipmentProfile(profile) {
  const item = profile.item;
  const commentHistory = (profile.history || [])
    .map((entry) => ({ ...entry, comment: historyCommentText(entry) }))
    .filter((entry) => entry.comment);

  $('#equipmentProfilePanel').classList.remove('hidden');
  $('#equipmentProfileBody').innerHTML = esc`
    <div><span>Cantidad</span><strong>${raw(Number(item.quantity ?? 1))}</strong></div>
    <div><span>Proveedor</span><strong>${item.supplier || 'Sin proveedor'}</strong></div>
    <div><span>Compra</span><strong>${item.purchase_date ? raw(String(item.purchase_date).slice(0, 10)) : 'Sin fecha'}</strong></div>
    <div><span>Garantia</span><strong>${item.warranty_until ? raw(String(item.warranty_until).slice(0, 10)) : 'Sin garantia'}</strong></div>
    <div><span>Actualizado por</span><strong>${item.updated_by_name || 'Sistema'}</strong></div>
  `;
  $('#equipmentQrBox').innerHTML = profile.qr_data_url
    ? esc`
      <div class="asset-label-preview">
        <img src="${raw(profile.qr_data_url)}" alt="QR del equipo">
        ${raw(code128Svg(item.serial_number))}
        <strong>${raw(escapeHtml(item.serial_number))}</strong>
      </div>
      <div class="qr-actions">
        <a href="${raw(profile.qr_url)}" target="_blank" rel="noreferrer">Abrir enlace</a>
        <button class="ghost" type="button" id="printAssetLabelButton">${raw(uiText('Imprimir etiqueta', 'Print label'))}</button>
      </div>
    `
    : '<p class="empty-module">QR no disponible.</p>';
  $('#printAssetLabelButton')?.addEventListener('click', printAssetLabel);
  $('#equipmentHistoryList').innerHTML = commentHistory.map((entry) => `
    <div>
      <strong>${escapeHtml(entry.comment)}</strong>
      <span>${escapeHtml(entry.changed_by || 'Sistema')} &middot; ${raw(formatDate(entry.created_at))} &middot; ${escapeHtml(historyAssignmentText(entry))}</span>
    </div>
  `).join('') || '<p class="empty-module">Sin comentarios guardados.</p>';
  $('#equipmentMaintenanceList').innerHTML = esc((profile.maintenance || []).map((entry) => `
    <div><strong>${raw(phaseLabel(entry.phase))}</strong><span>${raw(formatDate(entry.updated_at))} &middot; ${entry.notes || 'Sin notas'}</span></div>
  `).join('') || '<p class="empty-module">Sin mantenimiento.</p>');
}

async function openHardwareGroup(group) {
  state.inventoryDrill.typeId = String(group || '');
  state.inventoryDrill.brandId = '';
  state.inventoryDrill.modelId = '';
  renderHardwareTypeGrid();
}

async function openHardwareBrand(brandId) {
  state.inventoryDrill.brandId = String(brandId || '');
  state.inventoryDrill.modelId = '';
  renderHardwareTypeGrid();
}

async function openHardwareModel(modelId) {
  state.inventoryDrill.modelId = String(modelId || '');
  state.hardwareGroup = state.inventoryDrill.typeId;
  state.inventoryMeta.page = 1;
  $('#searchInput').value = '';
  $('#statusFilter').value = '';
  setView('inventory', { skipLoad: true });
  $('#backButton').classList.remove('hidden');
  $('#viewTitle').textContent = state.inventoryDrill.scope === 'accessories' ? 'Inventario de accesorios' : 'Inventario de activos';
  $('#viewSubtitle').textContent = 'Listado filtrado por tipo, marca y modelo';
  state.inventoryScope = state.inventoryDrill.scope;
  syncTypeFilterOptions();
  $('#typeFilter').value = state.inventoryDrill.typeId;
  syncInventoryBrandFilterOptions();
  $('#brandFilter').value = state.inventoryDrill.brandId;
  syncInventoryModelFilterOptions();
  $('#modelFilter').value = state.inventoryDrill.modelId;
  await loadInventory();
}

function scheduleStockHoverDetails(item, event) {
  clearTimeout(hoverDetailTimer);
  clearTimeout(hoverHideTimer);
  hoverPointer = { x: event.clientX, y: event.clientY };
  hoverDetailTimer = setTimeout(() => {
    clearTimeout(hoverHideTimer);
    renderStockPreview(item);
    positionHoverDetails();
    equipmentPreview.classList.add('equipment-preview--visible');
  }, 650);
}

function inventoryLocations() {
  const allowed = new Set(['Terminal', '2D']);
  return (state.lookups?.locations || []).filter((location) => allowed.has(location.name));
}

async function returnToInventory() {
  state.hardwareGroup = null;
  state.inventoryMeta.page = 1;
  $('#searchInput').value = '';
  $('#typeFilter').value = '';
  $('#brandFilter').value = '';
  $('#modelFilter').value = '';
  $('#statusFilter').value = '';
  setView('inventory', { skipLoad: true });
  await loadInventory();
}

async function goBack() {
  if ($('#hardwareView') && !$('#hardwareView').classList.contains('hidden')
    && (state.inventoryDrill.brandId || state.inventoryDrill.typeId)) {
    await backInventoryDrill();
    return;
  }
  const previous = state.viewHistory.pop();
  if (previous) {
    setView(previous, { fromHistory: true });
    if (previous === 'inventory') {
      await loadInventory();
    }
    if (previous === 'console') {
      await loadDashboardIfConsole();
    }
    return;
  }
  await returnToInventory();
}

async function backInventoryDrill() {
  if ($('#hardwareView') && !$('#hardwareView').classList.contains('hidden')) {
    if (state.inventoryDrill.brandId) {
      state.inventoryDrill.brandId = '';
      state.inventoryDrill.modelId = '';
      renderHardwareTypeGrid();
      return;
    }
    if (state.inventoryDrill.typeId) {
      state.inventoryDrill.typeId = '';
      renderHardwareTypeGrid();
      return;
    }
  }
  await goBack();
}

function openEquipment(item = null) {
  hideHoverDetails();
  equipmentForm.reset();
  $('#equipmentMessage').textContent = '';
  renderEquipmentImagePreview(item?.image_path ? equipmentImageUrl(item) : '');
  const writable = canWrite();
  $('#deleteButton').classList.toggle('hidden', !item || !writable);
  $('#saveEquipmentButton').classList.toggle('hidden', !writable);
  $('#dialogTitle').textContent = item
    ? `Detalle de ${isAccessoryItem(item) ? 'accesorio' : 'equipo'}`
    : `Nuevo ${state.inventoryScope === 'accessories' ? 'accesorio' : 'equipo'}`;

  equipmentForm.elements.id.value = item?.id || '';
  if (item) {
    const type = state.lookups.types.find((x) => x.name === item.equipment_type);
    const brand = state.lookups.brands.find((x) => x.name === item.brand);
    const model = state.lookups.models.find((x) => x.name === item.model);
    const location = state.lookups.locations.find((x) => x.name === item.location);
    const area = state.lookups.areas.find((x) => x.name === item.area && String(x.location_id) === String(location?.id));
    equipmentForm.elements.equipment_type_id.value = type?.id || '';
    syncBrandOptions({ preserve: false });
    equipmentForm.elements.brand_id.value = brand?.id || '';
    syncModelOptions({ preserve: false });
    equipmentForm.elements.model_id.value = model?.id || '';
    equipmentForm.elements.location_id.value = location?.id || '';
    syncAreaOptions();
    equipmentForm.elements.area_id.value = area?.id || '';
    equipmentForm.elements.serial_number.value = item.serial_number || '';
    equipmentForm.elements.asset_tag.value = item.asset_tag || '';
    equipmentForm.elements[fieldKeys.au].value = item[fieldKeys.au] || '';
    equipmentForm.elements.quantity.value = item.quantity ?? 1;
    equipmentForm.elements.status.value = item.status || 'activo';
    equipmentForm.elements.supplier.value = item.supplier || '';
    equipmentForm.elements.purchase_date.value = item.purchase_date ? String(item.purchase_date).slice(0, 10) : '';
    equipmentForm.elements.warranty_until.value = item.warranty_until ? String(item.warranty_until).slice(0, 10) : '';
    equipmentForm.elements.notes.value = item.notes || '';
    loadEquipmentProfile(item.id).catch((error) => {
      $('#equipmentMessage').textContent = error.message;
    });
  } else {
    loadEquipmentProfile(null);
    syncBrandOptions({ preserve: false });
    syncModelOptions({ preserve: false });
  }

  syncEquipmentFormMode();

  Array.from(equipmentForm.elements).forEach((field) => {
    if (['button', 'submit', 'hidden'].includes(field.type)) return;
    field.disabled = !writable;
  });
  equipmentDialog.showModal();
}

async function loadUsers() {
  if (state.user?.role !== 'ADMIN') return;
  const payload = await api('/users');
  state.users = payload.users || [];
  renderUsers();
}

function renderUsers() {
  const container = $('#userAdminList');
  if (!container) return;
  container.innerHTML = esc(state.users.map((user) => `
    <article class="user-admin-item" data-user-id="${raw(user.id)}">
      <div>
        <strong>${escapeHtml(user.name)}</strong>
        <span>${user.username} &middot; ${user.email} &middot; ${user.role} &middot; ${raw(user.is_active ? 'Activo' : 'Inactivo')}</span>
      </div>
      <div>
        <button class="ghost" type="button" data-user-edit="${raw(user.id)}">Modificar</button>
        <button class="danger" type="button" data-user-delete="${raw(user.id)}">Eliminar</button>
        <button class="ghost" type="button" data-user-toggle="${raw(user.id)}" data-active="${raw(user.is_active ? 'false' : 'true')}">${raw(user.is_active ? 'Desactivar' : 'Activar')}</button>
        <button class="ghost" type="button" data-user-reset="${raw(user.id)}">Reset</button>
      </div>
    </article>
  `).join('') || '<p class="empty-module">Sin usuarios.</p>');
  translateStaticText();
}

function openUserDialog(user = null) {
  userForm.reset();
  $('#userMessage').textContent = '';
  userForm.elements.id.value = user?.id || '';
  userForm.elements.name.value = user?.name || '';
  userForm.elements.username.value = user?.username || '';
  userForm.elements.email.value = user?.email || '';
  userForm.elements.role.value = user?.role || 'PERSONAL';
  userForm.elements.username.disabled = Boolean(user);
  userForm.elements.password.required = !user;
  userForm.elements.password.value = '';
  $('#userDialogTitle').textContent = user ? uiText('Editar usuario', 'Edit user') : uiText('Agregar usuario', 'Add user');
  $('#userPasswordField').childNodes[0].nodeValue = user ? uiText('Nueva contrasena opcional', 'Optional new password') : uiText('Contrasena inicial', 'Initial password');
  $('#deleteUserButton').classList.toggle('hidden', !user);
  $('#saveUserButton').textContent = user ? uiText('Actualizar usuario', 'Update user') : uiText('Guardar usuario', 'Save user');
  userDialog.showModal();
}

async function saveUser() {
  $('#userMessage').textContent = '';
  if (!userForm.reportValidity()) return;

  const data = Object.fromEntries(new FormData(userForm));
  const id = data.id;
  delete data.id;
  if (id) {
    const password = data.password;
    delete data.username;
    delete data.password;
    await api(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    if (password) {
      await api(apiRoute('users', id, fieldKeys.pw), {
        method: 'POST',
        body: JSON.stringify({ [fieldKeys.pw]: password })
      });
    }
  } else {
    await api('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  userForm.reset();
  userDialog.close();
  await loadUsers();
  toast(id ? uiText('Usuario actualizado.', 'User updated.') : uiText('Usuario guardado correctamente.', 'User saved successfully.'), 'success');
}

async function deleteUser(id) {
  if (!id || !confirm(uiText('Seguro que desea eliminar este registro?', 'Are you sure you want to delete this record?'))) return;
  await api(`/users/${id}`, { method: 'DELETE' });
  userDialog.close();
  await loadUsers();
  toast(uiText('Usuario eliminado.', 'User deleted.'), 'success');
}

async function importCsvFile(file) {
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  const previewResponse = await fetch(`${apiBaseUrl}/api/equipment/import/csv?dry_run=true`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: formData
  });
  const preview = await previewResponse.json().catch(() => ({}));
  if (!previewResponse.ok) throw new Error(preview.message || 'No se pudo validar el CSV.');
  if (!preview.ready) {
    const firstError = preview.rows?.find((row) => row.errors?.length)?.errors?.[0] || 'Revise el CSV.';
    throw new Error(`CSV con errores: ${firstError}`);
  }
  if (!confirm(`Importar ${preview.valid} equipos desde CSV?`)) return;

  const commitData = new FormData();
  commitData.append('file', file);
  const commitResponse = await fetch(`${apiBaseUrl}/api/equipment/import/csv?dry_run=false`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: commitData
  });
  const result = await commitResponse.json().catch(() => ({}));
  if (!commitResponse.ok) throw new Error(result.message || 'No se pudo importar el CSV.');
  toast(`Importacion completa: ${result.imported} equipos.`, 'success');
  await loadLookups();
  await loadInventory();
  await loadDashboardIfConsole();
}

function csvCell(value, delimiter = ';') {
  const text = String(value ?? '');
  const mustQuote = text.includes(delimiter) || /[",\r\n]/.test(text);
  return mustQuote ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadImportTemplate() {
  const headers = [
    'ID',
    'Tipo',
    'Marca',
    'Modelo',
    'Numero De Serie',
    'ID De Inventario',
    'Ubicacion',
    'Area',
    'Nombre De Usuario'
  ];
  const rows = [
    ['1', 'Laptop', 'Marca Ejemplo', 'Modelo Ejemplo', 'SERIE-EJEMPLO-001', 'INV-EJEMPLO-001', '2D', 'Area Ejemplo', 'USUARIO-EJEMPLO'],
    ['2', 'Monitor', 'Marca Ejemplo', 'Modelo Ejemplo', 'SERIE-EJEMPLO-002', 'INV-EJEMPLO-002', 'Terminal', 'Area Ejemplo', 'USUARIO-EJEMPLO']
  ];
  const csv = [
    headers.map((value) => csvCell(value)).join(';'),
    ...rows.map((row) => row.map((value) => csvCell(value)).join(';'))
  ].join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla-importacion-sati-timsa.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderEquipmentImagePreview(src) {
  const preview = $('#equipmentImagePreview');
  if (!preview) return;
  preview.classList.toggle('hidden', !src);
  preview.innerHTML = src ? zoomableImage(src, 'Vista previa de imagen del equipo') : '';
}

function renderStockImagePreview(src) {
  const preview = $('#stockImagePreview');
  if (!preview) return;
  preview.classList.toggle('hidden', !src);
  preview.innerHTML = src ? zoomableImage(src, 'Vista previa de foto de stock') : '';
}

function fillMaintenanceEquipmentOptions(selectedId = '') {
  const select = maintenanceForm.elements.equipment_id;
  select.innerHTML = '<option value="">Seleccionar equipo</option>';
  state.items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.serial_number} · ${item.brand} ${item.model} · ${item.location}`;
    option.selected = item.id === selectedId;
    select.appendChild(option);
  });
}

function openMaintenance(item = null) {
  maintenanceForm.reset();
  $('#maintenanceMessage').textContent = '';
  $('#maintenanceDialogTitle').textContent = item ? 'Actualizar mantenimiento' : 'Agregar mantenimiento';
  fillMaintenanceEquipmentOptions(item?.equipment_id || '');
  maintenanceForm.elements.id.value = item?.id || '';
  maintenanceForm.elements.equipment_id.disabled = Boolean(item);
  maintenanceForm.elements.phase.value = item?.phase || 'revisado';
  maintenanceForm.elements.notes.value = item?.notes || '';
  maintenanceDialog.showModal();
}

function openStockDialog(item = null) {
  stockForm.reset();
  $('#stockMessage').textContent = '';
  $('#stockDialogTitle').textContent = item ? 'Modificar dispositivo en stock' : 'Agregar dispositivo en stock';
  fillElementSelect(stockForm.elements.location_id, inventoryLocations(), 'Seleccionar');
  stockForm.elements.id.value = item?.id || '';
  stockForm.elements.item_code.value = item?.item_code || '';
  stockForm.elements.name.value = item?.name || '';
  stockForm.elements.model.value = item?.model || '';
  stockForm.elements.serial_number.value = item?.serial_number || '';
  stockForm.elements.quantity.value = item?.quantity ?? 1;
  stockForm.elements.location_id.value = item?.location_id || '';
  syncStockAreaOptions();
  stockForm.elements.area_id.value = item?.area_id || '';
  stockForm.elements.notes.value = item?.notes || '';
  renderStockImagePreview(item?.image_path ? stockImageUrl(item) : '');
  stockDialog.showModal();
}

function maintenancePayload() {
  const data = Object.fromEntries(new FormData(maintenanceForm));
  if (maintenanceForm.elements.equipment_id.disabled) {
    data.equipment_id = maintenanceForm.elements.equipment_id.value;
  }
  delete data.id;
  return data;
}

function stockPayload() {
  const data = Object.fromEntries(new FormData(stockForm));
  delete data.id;
  delete data.image;
  return data;
}

function normalizeOptionalDateField(name, label) {
  const field = equipmentForm.elements[name];
  const value = field.value;
  if (!value) return '';

  const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const year = Number(value.slice(0, 4));
  if (!validFormat || year < 1990 || year > 2100) {
    throw new Error(`${label} debe estar entre 1990 y 2100.`);
  }
  return value;
}

function formPayload() {
  const data = Object.fromEntries(new FormData(equipmentForm));
  delete data.id;
  delete data.image;
  data.quantity = Number(data.quantity || 1);

  if (isAccessoryFormMode()) {
    data.asset_tag = '';
    data.status = 'activo';
    data.purchase_date = '';
    data.warranty_until = '';
  }

  data.purchase_date = normalizeOptionalDateField('purchase_date', 'Fecha de compra');
  data.warranty_until = normalizeOptionalDateField('warranty_until', 'Garantia hasta');
  return data;
}

function validateImageFile(file) {
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La imagen no debe superar 5 MB.');
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Use una imagen JPG, PNG o WEBP.');
  }
}

async function compressedImageFile(file) {
  validateImageFile(file);
  if (file.type === 'image/webp' || file.size < 900 * 1024) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale >= 1 && file.size < 1.8 * 1024 * 1024) {
    bitmap.close?.();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d', { alpha: false });
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob || blob.size >= file.size) {
    return file;
  }

  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now()
  });
}

async function uploadEquipmentImage(equipmentId) {
  const file = equipmentForm.elements.image.files[0];
  if (!file) return null;

  const uploadFile = await compressedImageFile(file);

  const formData = new FormData();
  formData.append('image', uploadFile);
  const response = await fetch(`${apiBaseUrl}/api/equipment/${equipmentId}/image`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: formData
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'No se pudo subir la imagen.');
  }
  return payload.item;
}

async function uploadStockImage(stockId) {
  const file = stockForm.elements.image.files[0];
  if (!file) return null;

  const uploadFile = await compressedImageFile(file);

  const formData = new FormData();
  formData.append('image', uploadFile);
  const response = await fetch(`${apiBaseUrl}/api/stock/${stockId}/image`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: formData
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'No se pudo subir la foto de stock.');
  }
  return payload.item;
}

function selectedBrandName() {
  const brandId = Number(equipmentForm.elements.brand_id.value);
  return state.lookups?.brands.find((brand) => Number(brand.id) === brandId)?.name || '';
}

function openCatalogDialog(type) {
  $('#catalogMessage').textContent = '';
  catalogForm.reset();
  catalogForm.elements.catalog_type.value = type;
  catalogSource = stockDialog.open ? 'stock' : 'equipment';
  const activeLocationId = catalogSource === 'stock'
    ? stockForm.elements.location_id.value
    : equipmentForm.elements.location_id.value;

  const templates = {
    type: {
      title: 'Agregar tipo',
      html: '<label class="wide">Tipo nuevo<input name="name" required minlength="2" maxlength="80" placeholder="Ej. Scanner"></label>'
    },
    brand: {
      title: 'Agregar marca',
      html: '<label class="wide">Marca nueva<input name="name" required minlength="2" maxlength="80" placeholder="Ej. Samsung"></label>'
    },
    model: {
      title: 'Agregar modelo',
      html: `
        <label>Marca
          <select name="brand_id" required>
            ${state.lookups.brands.map((brand) => `
              <option value="${brand.id}" ${String(brand.id) === String(equipmentForm.elements.brand_id.value) ? 'selected' : ''}>${escapeHtml(brand.name)}</option>
            `).join('')}
          </select>
        </label>
        <label class="wide">Modelo nuevo<input name="name" required minlength="2" maxlength="120" placeholder="Ej. Latitude 5450"></label>
      `
    },
    location: {
      title: 'Agregar ubicacion',
      html: `
        <label>Ubicacion<input name="name" required minlength="2" maxlength="120" placeholder="Ej. Patio de Maniobras"></label>
        <label>Area inicial<input name="area_name" required minlength="2" maxlength="120" value="General"></label>
        <label class="wide">Direccion o referencia<input name="address" maxlength="500" placeholder="Referencia fisica opcional"></label>
      `
    },
    area: {
      title: 'Agregar area',
      html: `
        <label>Ubicacion
          <select name="location_id" required>
            ${state.lookups.locations.map((location) => `
              <option value="${location.id}" ${String(location.id) === String(activeLocationId) ? 'selected' : ''}>${escapeHtml(location.name)}</option>
            `).join('')}
          </select>
        </label>
        <label class="wide">Area nueva<input name="name" required minlength="2" maxlength="120" placeholder="Ej. Soporte TI"></label>
      `
    },
    [fieldKeys.au]: {
      title: 'Agregar nombre de usuario',
      html: `<label class="wide">Nombre de usuario<input name="${fieldKeys.au}" required minlength="2" maxlength="140" placeholder="Ej. Usuario"></label>`
    },
    supplier: {
      title: 'Agregar proveedor',
      html: '<label class="wide">Proveedor nuevo<input name="supplier" required minlength="2" maxlength="140" placeholder="Ej. Zebra"></label>'
    },
    serial: {
      title: 'Agregar serie',
      html: '<label class="wide">Numero de serie<input name="serial_number" required minlength="2" maxlength="140" placeholder="Ej. 5CD1234ABC"></label>'
    }
  };

  const config = templates[type];
  $('#catalogTitle').textContent = config.title;
  catalogFields.innerHTML = config.html;
  catalogDialog.showModal();
}

async function saveCatalogEntry() {
  $('#catalogMessage').textContent = '';
  if (!catalogForm.reportValidity()) return;

  const data = Object.fromEntries(new FormData(catalogForm));
  const type = data.catalog_type;

  try {
    if (type === 'type') {
      const payload = await api('/lookups/types', {
        method: 'POST',
        body: JSON.stringify({ name: data.name })
      });
      await loadLookups();
      equipmentForm.elements.equipment_type_id.value = String(payload.type.id);
      syncBrandOptions({ preserve: false });
      syncModelOptions({ preserve: false });
      syncEquipmentFormMode();
    }

    if (type === 'brand') {
      const payload = await api('/lookups/brands', {
        method: 'POST',
        body: JSON.stringify({ name: data.name })
      });
      await loadLookups();
      const selectedTypeId = Number(equipmentForm.elements.equipment_type_id.value);
      if (selectedTypeId) {
        state.lookups.type_brand_models.push({
          equipment_type_id: selectedTypeId,
          brand_id: Number(payload.brand.id),
          model_id: null
        });
        syncBrandOptions({ preserve: false });
      }
      equipmentForm.elements.brand_id.value = String(payload.brand.id);
      syncModelOptions({ preserve: false });
    }

    if (type === 'model') {
      const payload = await api('/lookups/models', {
        method: 'POST',
        body: JSON.stringify({ brand_id: data.brand_id, name: data.name })
      });
      await loadLookups();
      const selectedTypeId = Number(equipmentForm.elements.equipment_type_id.value);
      if (selectedTypeId) {
        state.lookups.type_brand_models.push({
          equipment_type_id: selectedTypeId,
          brand_id: Number(payload.model.brand_id),
          model_id: Number(payload.model.id)
        });
      }
      syncBrandOptions({ preserve: false });
      equipmentForm.elements.brand_id.value = String(payload.model.brand_id);
      syncModelOptions({ preserve: false });
      equipmentForm.elements.model_id.value = String(payload.model.id);
    }

    if (type === 'location') {
      const payload = await api('/lookups/locations', {
        method: 'POST',
        body: JSON.stringify({ name: data.name, address: data.address, area_name: data.area_name })
      });
      await loadLookups();
      if (catalogSource === 'stock') {
        stockForm.elements.location_id.value = String(payload.location.id);
        syncStockAreaOptions();
        stockForm.elements.area_id.value = String(payload.area.id);
      } else {
        equipmentForm.elements.location_id.value = String(payload.location.id);
        syncAreaOptions();
        equipmentForm.elements.area_id.value = String(payload.area.id);
      }
    }

    if (type === 'area') {
      const payload = await api('/lookups/areas', {
        method: 'POST',
        body: JSON.stringify({ location_id: data.location_id, name: data.name })
      });
      await loadLookups();
      if (catalogSource === 'stock') {
        stockForm.elements.location_id.value = String(payload.area.location_id);
        syncStockAreaOptions();
        stockForm.elements.area_id.value = String(payload.area.id);
      } else {
        equipmentForm.elements.location_id.value = String(payload.area.location_id);
        syncAreaOptions();
        equipmentForm.elements.area_id.value = String(payload.area.id);
      }
    }

    if (type === fieldKeys.au) {
      equipmentForm.elements[fieldKeys.au].value = data[fieldKeys.au];
    }

    if (type === 'supplier') {
      equipmentForm.elements.supplier.value = data.supplier;
      const exists = (state.lookups.suppliers || []).some((supplier) => supplier.name.toLowerCase() === data.supplier.toLowerCase());
      if (!exists) {
        state.lookups.suppliers = [...(state.lookups.suppliers || []), { name: data.supplier }];
      }
      renderSupplierOptions();
    }

    if (type === 'serial') {
      equipmentForm.elements.serial_number.value = data.serial_number;
    }

    catalogDialog.close();
    const label = data.name || data[fieldKeys.au] || data.supplier || data.serial_number;
    $('#equipmentMessage').textContent = `${label} listo para guardarse en la base de datos.`;
  } catch (error) {
    $('#catalogMessage').textContent = error.message;
  }
}

async function exportInventoryPdf() {
  const params = new URLSearchParams({
    search: $('#searchInput').value.trim(),
    type_id: $('#typeFilter').value,
    brand_id: $('#brandFilter')?.value || '',
    model_id: $('#modelFilter')?.value || '',
    status: $('#statusFilter').value
  });
  if (state.inventoryScope !== 'all') {
    params.set('scope', state.inventoryScope);
  }
  const response = await fetch(`${apiBaseUrl}/api/equipment/export/pdf?${params.toString()}`, {
    credentials: 'include'
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'No se pudo exportar el PDF.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sati-timsa-inventario-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportInventoryExcel() {
  const params = new URLSearchParams({
    search: $('#searchInput').value.trim(),
    type_id: $('#typeFilter').value,
    brand_id: $('#brandFilter')?.value || '',
    model_id: $('#modelFilter')?.value || '',
    status: $('#statusFilter').value
  });
  if (state.inventoryScope !== 'all') {
    params.set('scope', state.inventoryScope);
  }
  const response = await fetch(`${apiBaseUrl}/api/equipment/export/xlsx?${params.toString()}`, {
    credentials: 'include'
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'No se pudo exportar el Excel.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sati-timsa-inventario-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function boot() {
  clearStoredAuth();
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (error) {
    console.warn('No se pudo limpiar sesion previa:', error.message);
  }
  state.user = null;
  showLogin();
  applyResetLinkParams();
}

async function loadInitialDashboardData() {
  await loadLookups();
  await loadInventory();

  const optionalLoads = await Promise.allSettled([
    loadDashboardIfConsole(),
    loadMaintenance()
  ]);
  optionalLoads
    .filter((result) => result.status === 'rejected')
    .forEach((result) => console.warn('Carga secundaria no disponible:', result.reason));
}

function closeResetPanel() {
  resetForm.classList.add('hidden');
  $('#loginForm').classList.remove('hidden');
  $('#resetMessage').textContent = '';
  resetForm.reset();
}

function showResetPanel(message = '') {
  const loginForm = $('#loginForm');
  resetForm.elements.username.value = loginForm.elements.username.value || resetForm.elements.username.value || '';
  loginForm.classList.add('hidden');
  resetForm.classList.remove('hidden');
  $('#loginMessage').textContent = '';
  $('#resetMessage').textContent = message;
  resetForm.elements.username.focus();
}

function applyResetLinkParams() {
  const params = new URLSearchParams(window.location.search);
  const resetUser = params.get('reset_user');
  const resetCode = params.get('reset_code');
  if (!resetUser && !resetCode) return;

  showResetPanel('Escriba su nueva contrasena para continuar.');
  if (resetUser) resetForm.elements.username.value = resetUser;
  if (resetCode) resetForm.elements.reset_code.value = resetCode;

  params.delete('reset_user');
  params.delete('reset_code');
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
  window.history.replaceState({}, document.title, nextUrl);
}

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#loginMessage').textContent = '';
  try {
    const credentials = Object.fromEntries(new FormData(event.currentTarget));
    const rememberUsername = Boolean(credentials.remember_username);
    delete credentials.remember_username;
    await startSession(credentials, rememberUsername);
  } catch (error) {
    $('#loginMessage').textContent = error.message;
    if (error.message.includes('codigo') || error.message.includes('contrasena')) {
      showResetPanel(error.message);
    }
  }
});

$('#loginButton').addEventListener('click', () => {
  $('#loginForm').requestSubmit();
});

$('#loginForm').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    $('#loginForm').requestSubmit();
  }
});

$('#forgotPasswordLink').addEventListener('click', (event) => {
  event.preventDefault();
  showResetPanel();
});

$('#passwordToggle').addEventListener('click', () => {
  const secretInput = $('#loginForm').elements[fieldKeys.pw];
  const isSecret = secretInput.type === fieldKeys.pw;
  secretInput.type = isSecret ? 'text' : fieldKeys.pw;
  $('#passwordToggle').setAttribute('aria-label', isSecret ? 'Ocultar contrasena' : 'Mostrar contrasena');
});

$('#requestResetButton').addEventListener('click', async () => {
  $('#resetMessage').textContent = '';
  try {
    if (!resetForm.elements.username.reportValidity()) return;
    const username = resetForm.elements.username.value;
    const email = resetForm.elements.reset_email.value;
    const payload = await api(secretResetRoute('request'), {
      method: 'POST',
      body: JSON.stringify({ username, email })
    });
    $('#resetMessage').textContent = payload.message;
  } catch (error) {
    $('#resetMessage').textContent = error.message;
  }
});

$('#closeResetPanelButton').addEventListener('click', () => {
  $('#loginMessage').textContent = '';
  closeResetPanel();
});

$('#confirmResetButton').addEventListener('click', async () => {
  $('#resetMessage').textContent = '';
  try {
    if (!resetForm.reportValidity()) return;
    const payload = await api(secretResetRoute('confirm'), {
      method: 'POST',
      body: JSON.stringify({
        username: resetForm.elements.username.value,
        code: resetForm.elements.reset_code.value,
        [fieldKeys.pw]: resetForm.elements[fieldKeys.rp].value
      })
    });
    $('#resetMessage').textContent = payload.message;
    await startSession({
      username: resetForm.elements.username.value,
      [fieldKeys.pw]: resetForm.elements[fieldKeys.rp].value
    }, false);
  } catch (error) {
    $('#resetMessage').textContent = error.message;
  }
});

$('#logoutButton').addEventListener('click', async () => {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (error) {
    console.warn('No se pudo cerrar la sesion en servidor:', error.message);
  }
  clearStoredAuth();
  state.user = null;
  state.items = [];
  state.lookups = null;
  state.maintenance = [];
  state.stock = [];
  showLogin();
});

$('#notificationButton').addEventListener('click', () => {
  if (notificationPanel.classList.contains('hidden')) {
    openNotifications();
  } else {
    closeNotifications();
  }
});

$('#closeNotificationsButton').addEventListener('click', closeNotifications);

menuButton.addEventListener('click', toggleSidebar);
sidebarCollapseButton.addEventListener('click', openSettingsDialog);

noteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(noteForm));
  state.notes.unshift({
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()),
    text: data.text.trim(),
    dueAt: data.due_at,
    userId: state.user?.id || 'system',
    userName: state.user?.name || 'Usuario',
    createdAt: new Date().toISOString()
  });
  saveNotes();
  noteForm.reset();
  noteForm.elements.due_at.value = defaultReminderDate();
  renderNotifications();
});

$('#notificationList').addEventListener('click', (event) => {
  const button = event.target.closest('[data-note-delete]');
  if (!button) return;
  state.notes = state.notes.filter((note) => note.id !== button.dataset.noteDelete);
  saveNotes();
  renderNotifications();
});

$('#backButton').addEventListener('click', goBack);

document.querySelectorAll('[data-back-inventory]').forEach((button) => {
  button.addEventListener('click', backInventoryDrill);
});

$('#newEquipmentButton').addEventListener('click', () => openEquipment());
$('#newMaintenanceButton').addEventListener('click', () => openMaintenance());
$('#newStockButton').addEventListener('click', openStockDialog);
$('#newUserButton').addEventListener('click', () => {
  openUserDialog();
  loadUsers();
});

$('#addUserFromPanelButton').addEventListener('click', () => {
  openUserDialog();
});

$('#changePasswordButton').addEventListener('click', () => {
  passwordForm.reset();
  $('#passwordMessage').textContent = '';
  passwordDialog.showModal();
});

equipmentForm.elements.equipment_type_id.addEventListener('change', () => {
  syncBrandOptions({ preserve: false });
  syncModelOptions({ preserve: false });
  syncEquipmentFormMode();
});
equipmentForm.elements.brand_id.addEventListener('change', () => {
  syncModelOptions({ preserve: false });
});
equipmentForm.elements.location_id.addEventListener('change', syncAreaOptions);
stockForm.elements.location_id.addEventListener('change', syncStockAreaOptions);

equipmentForm.elements.image.addEventListener('change', () => {
  const file = equipmentForm.elements.image.files[0];
  if (!file) {
    const item = state.items.find((entry) => entry.id === equipmentForm.elements.id.value);
    renderEquipmentImagePreview(item?.image_path ? equipmentImageUrl(item) : '');
    return;
  }
  renderEquipmentImagePreview(URL.createObjectURL(file));
});

stockForm.elements.image.addEventListener('change', () => {
  const file = stockForm.elements.image.files[0];
  if (!file) {
    const item = state.stock.find((entry) => entry.id === stockForm.elements.id.value);
    renderStockImagePreview(item?.image_path ? stockImageUrl(item) : '');
    return;
  }
  renderStockImagePreview(URL.createObjectURL(file));
});

equipmentForm.addEventListener('click', (event) => {
  const button = event.target.closest('[data-add-catalog]');
  if (!button) return;
  openCatalogDialog(button.dataset.addCatalog);
});

stockForm.addEventListener('click', (event) => {
  const button = event.target.closest('[data-add-catalog]');
  if (!button) return;
  openCatalogDialog(button.dataset.addCatalog);
});

$('#saveCatalogButton').addEventListener('click', saveCatalogEntry);

document.querySelectorAll('nav a[data-view]').forEach((link) => {
  link.addEventListener('click', async (event) => {
    event.preventDefault();
    if (link.dataset.view === 'inventory') {
      state.hardwareGroup = null;
      state.inventoryMeta.page = 1;
      $('#searchInput').value = '';
      $('#typeFilter').value = '';
      $('#brandFilter').value = '';
      $('#modelFilter').value = '';
      $('#statusFilter').value = '';
      setView('inventory', { skipLoad: true });
      await loadInventory();
      return;
    }
    setView(link.dataset.view);
  });
});

$('#searchInput').addEventListener('input', () => {
  state.hardwareGroup = null;
  state.inventoryMeta.page = 1;
  clearTimeout(window.searchTimer);
  window.searchTimer = setTimeout(loadInventory, 250);
});

$('#typeFilter').addEventListener('change', () => {
  state.hardwareGroup = null;
  state.inventoryMeta.page = 1;
  $('#brandFilter').value = '';
  $('#modelFilter').value = '';
  syncInventoryBrandFilterOptions();
  syncInventoryModelFilterOptions();
  loadInventory();
});

$('#brandFilter').addEventListener('change', () => {
  state.hardwareGroup = null;
  state.inventoryMeta.page = 1;
  $('#modelFilter').value = '';
  syncInventoryModelFilterOptions();
  loadInventory();
});

$('#modelFilter').addEventListener('change', () => {
  state.hardwareGroup = null;
  state.inventoryMeta.page = 1;
  loadInventory();
});

$('#statusFilter').addEventListener('change', () => {
  state.hardwareGroup = null;
  state.inventoryMeta.page = 1;
  loadInventory();
});

$('#prevPageButton').addEventListener('click', () => {
  if (state.inventoryMeta.page <= 1) return;
  state.inventoryMeta.page -= 1;
  loadInventory();
});

$('#nextPageButton').addEventListener('click', () => {
  if (state.inventoryMeta.page >= state.inventoryMeta.total_pages) return;
  state.inventoryMeta.page += 1;
  loadInventory();
});

$('#pageSizeSelect').addEventListener('change', () => {
  state.inventoryMeta.limit = Number($('#pageSizeSelect').value || 25);
  state.settings.pageSize = String(state.inventoryMeta.limit);
  saveSettingsState();
  syncSettingsForm();
  state.inventoryMeta.page = 1;
  loadInventory();
});

$('#exportPdfButton').addEventListener('click', async () => {
  try {
    await exportInventoryPdf();
    toast(uiText('PDF generado correctamente.', 'PDF generated successfully.'), 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
});

$('#exportExcelButton').addEventListener('click', async () => {
  try {
    await exportInventoryExcel();
    toast(uiText('Excel generado correctamente.', 'Excel generated successfully.'), 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
});

$('#downloadTemplateButton').addEventListener('click', downloadImportTemplate);

$('#importCsvButton').addEventListener('click', () => $('#csvImportInput').click());

$('#csvImportInput').addEventListener('change', async () => {
  try {
    await importCsvFile($('#csvImportInput').files[0]);
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    $('#csvImportInput').value = '';
  }
});

$('#applyAuditFiltersButton').addEventListener('click', loadAudit);

$('#applyRecentFiltersButton').addEventListener('click', () => {
  state.recentMeta.page = 1;
  loadRecentChanges();
});

$('#recentSearchFilter').addEventListener('input', () => {
  clearTimeout(window.recentSearchTimer);
  window.recentSearchTimer = setTimeout(() => {
    state.recentMeta.page = 1;
    loadRecentChanges();
  }, 250);
});

$('#prevRecentPageButton').addEventListener('click', () => {
  if (state.recentMeta.page <= 1) return;
  state.recentMeta.page -= 1;
  loadRecentChanges();
});

$('#nextRecentPageButton').addEventListener('click', () => {
  if (state.recentMeta.page >= state.recentMeta.total_pages) return;
  state.recentMeta.page += 1;
  loadRecentChanges();
});

$('#recentPageSizeSelect').addEventListener('change', () => {
  state.recentMeta.limit = Number($('#recentPageSizeSelect').value || 25);
  state.recentMeta.page = 1;
  loadRecentChanges();
});

['#recentUsernameFilter', '#recentActionFilter', '#recentEntityFilter', '#recentFromFilter', '#recentToFilter'].forEach((selector) => {
  $(selector).addEventListener('change', () => {
    state.recentMeta.page = 1;
    loadRecentChanges();
  });
});

$('#exportRecentButton').addEventListener('click', async () => {
  const params = new URLSearchParams({
    search: $('#recentSearchFilter').value.trim(),
    username: $('#recentUsernameFilter').value.trim(),
    action: $('#recentActionFilter').value.trim(),
    entity: $('#recentEntityFilter').value.trim(),
    date_from: $('#recentFromFilter').value,
    date_to: $('#recentToFilter').value
  });
  const response = await fetch(`${apiBaseUrl}/api/audit/export.csv?${params.toString()}`, {
    credentials: 'include'
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    toast(payload.message || 'No se pudieron exportar los cambios.', 'error');
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sati-timsa-cambios-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast(uiText('Cambios recientes exportados.', 'Recent changes exported.'), 'success');
});

$('#saveSettingsButton').addEventListener('click', () => {
  state.settings = Object.fromEntries(new FormData(settingsForm));
  saveSettingsState();
  applySettings();
  settingsDialog.close();
  toast(uiText('Ajustes aplicados correctamente.', 'Settings applied successfully.'), 'success');
});

$('#resetSettingsButton').addEventListener('click', () => {
  state.settings = defaultSettings();
  saveSettingsState();
  applySettings();
  $('#settingsMessage').textContent = 'Ajustes restablecidos.';
});

$('#applyStockFiltersButton').addEventListener('click', loadStock);
$('#stockLocationFilter').addEventListener('change', () => {
  syncStockFilterAreas();
  loadStock();
});
$('#stockAreaFilter').addEventListener('change', loadStock);
$('#stockSearchInput').addEventListener('input', () => {
  clearTimeout(window.stockSearchTimer);
  window.stockSearchTimer = setTimeout(loadStock, 250);
});

$('#stockList').addEventListener('click', (event) => {
  const button = event.target.closest('[data-stock-edit]');
  if (!button) return;
  const item = state.stock.find((entry) => entry.id === button.dataset.stockEdit);
  if (item) openStockDialog(item);
});

$('#stockList').addEventListener('mouseenter', (event) => {
  const card = event.target.closest('[data-stock-id]');
  if (!card) return;
  const item = state.stock.find((entry) => entry.id === card.dataset.stockId);
  if (item) scheduleStockHoverDetails(item, event);
}, true);

$('#stockList').addEventListener('mousemove', (event) => {
  if (equipmentPreview.matches(':hover')) return;
  hoverPointer = { x: event.clientX, y: event.clientY };
});

$('#stockList').addEventListener('mouseleave', (event) => {
  const card = event.target.closest('[data-stock-id]');
  if (!card || card.contains(event.relatedTarget)) return;
  if (equipmentPreview.contains(event.relatedTarget)) return;
  hideHoverDetails(450);
}, true);

$('#exportAuditButton').addEventListener('click', async () => {
  const params = new URLSearchParams({
    username: $('#auditUsernameFilter').value.trim(),
    action: $('#auditActionFilter').value.trim(),
    entity: $('#auditEntityFilter').value.trim(),
    date_from: $('#auditFromFilter').value,
    date_to: $('#auditToFilter').value
  });
  const response = await fetch(`${apiBaseUrl}/api/audit/export.csv?${params.toString()}`, {
    credentials: 'include'
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    toast(payload.message || 'No se pudo exportar auditoria.', 'error');
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sati-timsa-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast('Auditoria exportada correctamente.', 'success');
});

$('#maintenanceList').addEventListener('click', (event) => {
  const button = event.target.closest('[data-maintenance-edit]');
  if (!button) return;
  const item = state.maintenance.find((entry) => entry.id === button.dataset.maintenanceEdit);
  openMaintenance(item);
});

$('#hardwareView').addEventListener('click', async (event) => {
  const option = event.target.closest('[data-drill-type-id], [data-drill-brand-id], [data-drill-model-id], [data-hardware-type-id], [data-hardware-group]');
  if (!option) return;
  if (option.dataset.drillBrandId) return openHardwareBrand(option.dataset.drillBrandId);
  if (option.dataset.drillModelId) return openHardwareModel(option.dataset.drillModelId);
  await openHardwareGroup(option.dataset.drillTypeId || option.dataset.hardwareTypeId || option.dataset.hardwareGroup);
});

$('#hardwareView').addEventListener('keydown', async (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  const option = event.target.closest('[data-drill-type-id], [data-drill-brand-id], [data-drill-model-id], [data-hardware-type-id], [data-hardware-group]');
  if (!option) return;
  event.preventDefault();
  if (option.dataset.drillBrandId) return openHardwareBrand(option.dataset.drillBrandId);
  if (option.dataset.drillModelId) return openHardwareModel(option.dataset.drillModelId);
  await openHardwareGroup(option.dataset.drillTypeId || option.dataset.hardwareTypeId || option.dataset.hardwareGroup);
});

document.addEventListener('contextmenu', (event) => {
  const catalogTarget = catalogTargetFromEvent(event);
  if (catalogTarget) {
    openCatalogContextMenu(event, catalogTarget);
    return;
  }
  const recordTarget = recordTargetFromEvent(event);
  if (recordTarget) openRecordContextMenu(event, recordTarget);
});

document.addEventListener('click', async (event) => {
  const actionButton = event.target.closest('[data-catalog-action]');
  const recordButton = event.target.closest('[data-record-action]');
  if (recordButton) {
    try {
      if (recordButton.dataset.recordAction === 'edit') await editRecordTarget();
      if (recordButton.dataset.recordAction === 'delete') await deleteRecordTarget();
    } catch (error) {
      toast(error.message, 'error');
    }
    return;
  }
  if (!actionButton) {
    if (!event.target.closest('#catalogContextMenu')) closeCatalogContextMenu();
    if (!event.target.closest('#recordContextMenu')) closeRecordContextMenu();
    return;
  }

  try {
    if (actionButton.dataset.catalogAction === 'edit') await editCatalogTarget();
    if (actionButton.dataset.catalogAction === 'delete') await deleteCatalogTarget();
  } catch (error) {
    toast(error.message, 'error');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeCatalogContextMenu();
  if (event.key === 'Escape') closeRecordContextMenu();
});

window.addEventListener('scroll', () => {
  closeCatalogContextMenu();
  closeRecordContextMenu();
}, true);

inventoryBody.addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit]');
  const row = event.target.closest('tr');
  const id = button?.dataset.edit || row?.querySelector('[data-edit]')?.dataset.edit;
  if (!id) return;
  const item = state.items.find((entry) => entry.id === id);
  openEquipment(item);
});

inventoryBody.addEventListener('mouseover', (event) => {
  const cell = event.target.closest('td[data-hover-detail]');
  if (!cell || cell.contains(event.relatedTarget)) return;
  const row = cell.closest('tr[data-item-id]');
  const item = state.items.find((entry) => entry.id === row.dataset.itemId);
  if (item) scheduleHoverDetails(item, event);
});

inventoryBody.addEventListener('mousemove', (event) => {
  if (equipmentPreview.matches(':hover')) return;
  hoverPointer = { x: event.clientX, y: event.clientY };
});

inventoryBody.addEventListener('mouseout', (event) => {
  const cell = event.target.closest('td[data-hover-detail]');
  if (!cell || cell.contains(event.relatedTarget)) return;
  if (equipmentPreview.contains(event.relatedTarget)) return;
  hideHoverDetails(650);
});

equipmentPreview.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-preview]')) {
    hideHoverDetails();
    return;
  }
  const button = event.target.closest('[data-preview-open]');
  if (!button) return;
  const item = state.items.find((entry) => entry.id === button.dataset.previewOpen);
  openEquipment(item);
});

equipmentPreview.addEventListener('click', (event) => {
  const button = event.target.closest('[data-stock-preview-edit]');
  if (!button) return;
  const item = state.stock.find((entry) => entry.id === button.dataset.stockPreviewEdit);
  if (item) openStockDialog(item);
});

equipmentPreview.addEventListener('mouseenter', () => {
  clearTimeout(hoverDetailTimer);
  clearTimeout(hoverHideTimer);
  if (!equipmentPreview.classList.contains('hidden')) {
    equipmentPreview.classList.add('equipment-preview--visible');
  }
});

equipmentPreview.addEventListener('mouseleave', (event) => {
  const row = event.relatedTarget?.closest?.('tr[data-item-id]');
  if (row && inventoryBody.contains(row)) return;
  const stockCard = event.relatedTarget?.closest?.('[data-stock-id]');
  if (stockCard && $('#stockList').contains(stockCard)) return;
  hideHoverDetails(250);
});

document.addEventListener('click', (event) => {
  const image = event.target.closest('img[data-image-zoom]');
  if (!image) return;
  event.preventDefault();
  event.stopPropagation();
  openImageViewer(image.dataset.imageZoom || image.src, image.dataset.imageTitle || image.alt || 'Imagen');
});

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-image-viewer]')) {
    closeImageViewer();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeImageViewer();
  }
});

window.addEventListener('resize', () => {
  if (equipmentPreview.classList.contains('equipment-preview--visible')) {
    positionHoverDetails();
  }
});

$('#saveEquipmentButton').addEventListener('click', async () => {
  $('#equipmentMessage').textContent = '';
  if (!equipmentForm.reportValidity()) return;

  const saveButton = $('#saveEquipmentButton');
  const originalText = saveButton.textContent;
  saveButton.disabled = true;
  saveButton.textContent = 'Guardando...';

  try {
    const id = equipmentForm.elements.id.value;
    const data = formPayload();
    const payload = await api(id ? `/equipment/${id}` : '/equipment', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    });
    const savedId = id || payload.item.id;
    let imageWarning = '';
    try {
      await uploadEquipmentImage(savedId);
    } catch (imageError) {
      imageWarning = `\n\nEl registro si se guardo, pero la imagen no se pudo subir: ${imageError.message}`;
    }
    equipmentDialog.close();
    await loadInventory();
    if (state.inventoryScope === 'all') {
      await loadDashboardIfConsole();
    }
    toast(`${id ? 'Equipo actualizado correctamente.' : 'Equipo guardado correctamente.'}${imageWarning}`, imageWarning ? 'warning' : 'success');
  } catch (error) {
    $('#equipmentMessage').textContent = error.message;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = originalText;
  }
});

$('#deleteButton').addEventListener('click', async () => {
  const id = equipmentForm.elements.id.value;
  if (!id || !confirm('Eliminar este equipo del inventario?')) return;

  try {
    await api(`/equipment/${id}`, { method: 'DELETE' });
    equipmentDialog.close();
    await loadInventory();
    await loadDashboardIfConsole();
  } catch (error) {
    $('#equipmentMessage').textContent = error.message;
  }
});

$('#saveMaintenanceButton').addEventListener('click', async () => {
  $('#maintenanceMessage').textContent = '';
  if (!maintenanceForm.reportValidity()) return;

  try {
    const id = maintenanceForm.elements.id.value;
    const completedMaintenance = maintenanceForm.elements.phase.value === 'terminado';
    await api(id ? `/maintenance/${id}` : '/maintenance', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(maintenancePayload())
    });
    maintenanceForm.elements.equipment_id.disabled = false;
    maintenanceDialog.close();
    if (completedMaintenance) {
      state.inventoryMeta.page = 1;
      await loadMaintenance();
      await loadInventory();
    } else {
      await loadMaintenance();
      await loadInventory();
    }
    await loadDashboardIfConsole();
  } catch (error) {
    $('#maintenanceMessage').textContent = error.message;
  }
});

$('#saveStockButton').addEventListener('click', async () => {
  $('#stockMessage').textContent = '';
  if (!stockForm.reportValidity()) return;
  const saveButton = $('#saveStockButton');
  const originalText = saveButton.textContent;
  saveButton.disabled = true;
  saveButton.textContent = 'Guardando...';
  try {
    const id = stockForm.elements.id.value;
    const payload = await api(id ? `/stock/${id}` : '/stock', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(stockPayload())
    });
    let imageWarning = '';
    try {
      await uploadStockImage(id || payload.item.id);
    } catch (imageError) {
      imageWarning = `\n\nEl registro si se guardo, pero la imagen no se pudo subir: ${imageError.message}`;
    }
    stockDialog.close();
    await loadStock();
    await loadDashboardIfConsole();
    toast(`${id ? 'Stock actualizado correctamente.' : 'Stock guardado correctamente.'}${imageWarning}`, imageWarning ? 'warning' : 'success');
  } catch (error) {
    $('#stockMessage').textContent = error.message;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = originalText;
  }
});

maintenanceDialog.addEventListener('close', () => {
  maintenanceForm.elements.equipment_id.disabled = false;
});

userForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') {
    userDialog.close();
    return;
  }
  try {
    await saveUser();
  } catch (error) {
    $('#userMessage').textContent = error.message;
  }
});

$('#saveUserButton').addEventListener('click', async () => {
  try {
    await saveUser();
  } catch (error) {
    $('#userMessage').textContent = error.message;
  }
});

$('#deleteUserButton').addEventListener('click', async () => {
  try {
    await deleteUser(userForm.elements.id.value);
  } catch (error) {
    $('#userMessage').textContent = error.message;
  }
});

$('#userAdminList').addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-user-edit]');
  const remove = event.target.closest('[data-user-delete]');
  const toggle = event.target.closest('[data-user-toggle]');
  const reset = event.target.closest('[data-user-reset]');
  try {
    if (edit) {
      const user = state.users.find((entry) => entry.id === edit.dataset.userEdit);
      if (user) openUserDialog(user);
    }
    if (remove) {
      await deleteUser(remove.dataset.userDelete);
    }
    if (toggle) {
      await api(`/users/${toggle.dataset.userToggle}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: toggle.dataset.active === 'true' })
      });
      await loadUsers();
      toast('Usuario actualizado.', 'success');
    }
    if (reset) {
      const secret = prompt('Nueva contrasena maxima de 12 caracteres:');
      if (!secret) return;
      await api(apiRoute('users', reset.dataset.userReset, fieldKeys.pw), {
        method: 'POST',
        body: JSON.stringify({ [fieldKeys.pw]: secret })
      });
      toast(uiText('Contrasena reiniciada.', 'Password reset.'), 'success');
    }
  } catch (error) {
    toast(error.message, 'error');
  }
});

$('#savePasswordButton').addEventListener('click', async () => {
  $('#passwordMessage').textContent = '';
  if (!passwordForm.reportValidity()) return;
  try {
    const secretData = Object.fromEntries(new FormData(passwordForm));
    const payload = await api(apiRoute('auth', fieldKeys.pw), {
      method: 'POST',
      body: JSON.stringify(secretData)
    });
    $('#passwordMessage').textContent = payload.message;
    passwordForm.reset();
  } catch (error) {
    $('#passwordMessage').textContent = error.message;
  }
});

applySettings();
boot();
