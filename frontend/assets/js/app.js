const state = {
  token: null,
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
  users: [],
  equipmentProfile: null,
  hardwareGroup: null,
  inventoryScope: 'all',
  notes: readStoredNotes()
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));
const safeUrl = (value) => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:image/')) return escapeHtml(url);
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol) ? escapeHtml(url) : '';
  } catch {
    return '';
  }
};
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
const notificationPanel = $('#notificationPanel');
const noteForm = $('#noteForm');
const menuButton = $('#menuButton');
const sidebarCollapseButton = $('#sidebarCollapseButton');
let hoverDetailTimer = null;
let hoverHideTimer = null;
let hoverPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let catalogSource = 'equipment';
let dashboardChartInstances = {};
let inventoryRequestId = 0;
let searchTimer = null;
const apiBaseUrl = String(window.SATI_API_BASE_URL || '').replace(/\/$/, '');
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

document.body.appendChild(equipmentPreview);

function canWrite() {
  return ['ADMIN', 'TI'].includes(state.user?.role);
}

function isAdmin() {
  return state.user?.role === 'ADMIN';
}

function readStoredNotes() {
  try {
    const notes = JSON.parse(localStorage.getItem('sati_notes') || '[]');
    return Array.isArray(notes) ? notes : [];
  } catch {
    localStorage.removeItem('sati_notes');
    return [];
  }
}

function saveAuthSession() {
  sessionStorage.setItem('sati_token', state.token || '');
  sessionStorage.setItem('sati_user', JSON.stringify(state.user || null));
}

function clearAuthSession() {
  sessionStorage.removeItem('sati_token');
  sessionStorage.removeItem('sati_user');
  localStorage.removeItem('sati_token');
  localStorage.removeItem('sati_user');
}

async function api(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));
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
  setView('inventory');
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
  $('#newUserButton').style.display = isAdmin() ? '' : 'none';

  document.querySelectorAll('nav a[data-view]').forEach((link) => {
    if (link.dataset.view === 'users') {
      link.style.display = isAdmin() ? '' : 'none';
    } else if (link.dataset.view === 'audit') {
      link.style.display = canWrite() ? '' : 'none';
    } else {
      link.style.display = '';
    }
  });
}

function applySidebarState() {
  const collapsed = localStorage.getItem('sati_sidebar_collapsed') === 'true';
  dashboardView.classList.toggle('sidebar-collapsed', collapsed);
  menuButton.setAttribute('aria-expanded', String(!collapsed));
  menuButton.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Contraer menu');
  sidebarCollapseButton.setAttribute('aria-label', collapsed ? 'Expandir' : 'Contraer');
}

function toggleSidebar() {
  const collapsed = !dashboardView.classList.contains('sidebar-collapsed');
  dashboardView.classList.toggle('sidebar-collapsed', collapsed);
  localStorage.setItem('sati_sidebar_collapsed', String(collapsed));
  applySidebarState();
}

function setView(view) {
  const views = {
    inventory: ['Consola de inventario', 'Resumen general del inventario de activos'],
    hardware: ['Inventario de activos', 'Laptops, monitores, desktops, red, servidores y movilidad'],
    equipment: ['Inventario de activos', 'Clasificacion por tipo de activo'],
    accessories: ['Inventario de accesorios', 'Perifericos y accesorios asignados o en resguardo'],
    maintenance: ['Equipos en mantenimiento', 'Seguimiento por fases de revision, proceso y termino'],
    stock: ['Stock de almacenamiento', 'Disponibilidad por ubicacion y area'],
    audit: ['Auditoria', 'Eventos recientes y controles del sistema'],
    cloud: ['Servicios cloud', 'Servicios conectados al sistema SATI-TIMSA'],
    users: ['Usuarios', 'Gestion de acceso y roles del sistema']
  };

  if (view === 'accessories') state.inventoryScope = 'accessories';
  if (view === 'equipment') state.inventoryScope = 'equipment';
  if (view === 'inventory') state.inventoryScope = 'all';

  const selected = views[view] || views.inventory;
  $('#viewTitle').textContent = selected[0];
  $('#viewSubtitle').textContent = selected[1];
  $('#backButton').classList.toggle('hidden', view === 'inventory');
  $('#newEquipmentButton').innerHTML = `<span class="button-icon">+</span>${view === 'accessories' ? 'Nuevo accesorio' : 'Nuevo activo'}`;
  const totalMetricLabel = $('#metricsView article:first-child small');
  if (totalMetricLabel) {
    totalMetricLabel.textContent = view === 'accessories' ? 'Accesorios registrados' : 'Activos registrados';
  }

  const hideDashboardWidgets = view === 'audit' || view === 'cloud' || view === 'stock' || view === 'users';
  $('#metricsView').classList.toggle('hidden', hideDashboardWidgets);
  $('#dashboardKpis').classList.toggle('hidden', hideDashboardWidgets);
  $('#dashboardCharts').classList.toggle('hidden', hideDashboardWidgets);
  $('#dashboardInsights').classList.toggle('hidden', hideDashboardWidgets);
  activatePanel('inventoryView', view === 'inventory' || view === 'accessories');
  activatePanel('hardwareView', view === 'hardware');
  activatePanel('equipmentView', view === 'equipment');
  activatePanel('maintenanceView', view === 'maintenance');
  activatePanel('stockView', view === 'stock');
  activatePanel('auditView', view === 'audit');
  activatePanel('cloudView', view === 'cloud');
  activatePanel('usersView', view === 'users');
  hideHoverDetails();

  document.querySelectorAll('nav a[data-view]').forEach((link) => {
    link.classList.toggle('active', link.dataset.view === view);
  });

  syncTypeFilterOptions();
  if (view === 'equipment') renderEquipmentTypeList();
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
  if (view === 'users') {
    loadUsers();
  }
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
  const rememberedUsername = localStorage.getItem('sati_remember_username') || '';
  if (rememberedUsername && !$('#loginForm').elements.username.value) {
    $('#loginForm').elements.username.value = rememberedUsername;
    $('#loginForm').elements.remember_username.checked = true;
  }
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

function saveNotes() {
  localStorage.setItem('sati_notes', JSON.stringify(state.notes));
}

function renderNotifications() {
  const list = $('#notificationList');
  const count = $('#notificationCount');
  if (!list || !count) return;

  const sortedNotes = [...state.notes].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  count.textContent = sortedNotes.length;
  count.classList.toggle('hidden', sortedNotes.length === 0);

  list.innerHTML = sortedNotes.map((note) => `
    <article class="notification-item">
      <div>
        <strong>${escapeHtml(note.text)}</strong>
        <span>${escapeHtml(formatDate(note.dueAt))}</span>
      </div>
      <footer>
        <span>Agregado por ${escapeHtml(note.userName)}</span>
        <button class="ghost note-delete" type="button" data-note-delete="${escapeHtml(note.id)}">Eliminar</button>
      </footer>
    </article>
  `).join('') || '<p class="empty-module">Sin notas pendientes.</p>';
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

function renderMetrics() {
  const total = state.items.length;
  const active = state.items.filter((item) => item.status === 'activo').length;
  const maintenance = state.items.filter((item) => item.status === 'mantenimiento').length;
  const inactive = state.items.filter((item) => ['baja', 'resguardo'].includes(item.status)).length;
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
  $('#statusLegend').innerHTML = statusItems.map((item) => `
    <div><i class="${item.className}"></i><span>${item.label}</span><strong>${item.value}</strong></div>
  `).join('');

  const warranty = dashboard.warranty || {};
  $('#warrantyInsights').innerHTML = `
    <div><strong>${warranty.expired || 0}</strong><span>Vencidas</span></div>
    <div><strong>${warranty.next_30 || 0}</strong><span>Proximos 30 dias</span></div>
    <div><strong>${warranty.next_90 || 0}</strong><span>Proximos 90 dias</span></div>
  `;

  const maxType = Math.max(1, ...(dashboard.by_type || []).map((item) => Number(item.total)));
  $('#typeInsights').innerHTML = (dashboard.by_type || []).map((item) => `
    <div class="insight-bar">
      <span>${escapeHtml(item.equipment_type)}</span>
      <strong>${escapeHtml(item.total)}</strong>
      <i data-width="${Math.max(6, Math.round((Number(item.total) / maxType) * 100))}"></i>
    </div>
  `).join('') || '<p class="empty-module">Sin datos por tipo.</p>';

  const maxLocation = Math.max(1, ...(dashboard.by_location || []).map((item) => Number(item.total)));
  $('#locationInsights').innerHTML = (dashboard.by_location || []).map((item) => `
    <div class="insight-bar">
      <span>${escapeHtml(item.location)}</span>
      <strong>${escapeHtml(item.total)}</strong>
      <i data-width="${Math.max(6, Math.round((Number(item.total) / maxLocation) * 100))}"></i>
    </div>
  `).join('') || '<p class="empty-module">Sin datos por ubicacion.</p>';

  const maxMaintenance = Math.max(1, ...(dashboard.maintenance || []).map((item) => Number(item.total)));
  $('#maintenanceInsights').innerHTML = (dashboard.maintenance || []).map((item) => `
    <div class="insight-bar">
      <span>${escapeHtml(phaseLabel(item.phase))}</span>
      <strong>${escapeHtml(item.total)}</strong>
      <i data-width="${Math.max(6, Math.round((Number(item.total) / maxMaintenance) * 100))}"></i>
    </div>
  `).join('') || '<p class="empty-module">Sin ordenes de mantenimiento.</p>';

  const stock = dashboard.stock || {};
  $('#stockInsights').innerHTML = `
    <div><strong>${stock.total_quantity || 0}</strong><span>Unidades disponibles</span></div>
    <div><strong>${stock.total_items || 0}</strong><span>Registros en stock</span></div>
    <div><strong>${stock.with_images || 0}</strong><span>Con foto</span></div>
  `;

  document.querySelectorAll('#dashboardInsights i[data-width]').forEach((bar) => {
    bar.style.width = `${bar.dataset.width}%`;
  });

  $('#recentInsights').innerHTML = (dashboard.recent_changes || []).map((item) => `
    <div><strong>${escapeHtml(item.serial_number)}</strong><span>${escapeHtml(item.event_type)} &middot; Usuario asignado: ${escapeHtml(item.assigned_user || 'Sin asignar')} &middot; ${escapeHtml(item.username || 'sistema')} &middot; ${escapeHtml(formatDate(item.created_at))}</span></div>
  `).join('') || '<p class="empty-module">Sin cambios recientes.</p>';
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
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#334155', boxWidth: 12 } }
    }
  };

  dashboardChartInstances.tipos = new Chart($('#chartTipos'), {
    type: 'doughnut',
    data: {
      labels: tipos.map((item) => item.tipo),
      datasets: [{
        data: tipos.map((item) => Number(item.total || 0)),
        backgroundColor: chartColors(tipos.length),
        borderColor: '#ffffff',
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
        label: 'Equipos',
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
        x: { beginAtZero: true, ticks: { precision: 0, color: '#64748b' }, grid: { color: '#e5e7eb' } },
        y: { ticks: { color: '#334155' }, grid: { display: false } }
      }
    }
  });

  dashboardChartInstances.mantenimiento = new Chart($('#chartMantenimiento'), {
    type: 'bar',
    data: {
      labels: mantenimiento.map((item) => phaseLabel(item.fase)),
      datasets: [{
        label: 'Equipos',
        data: mantenimiento.map((item) => Number(item.total || 0)),
        backgroundColor: chartColors(mantenimiento.length, true),
        borderRadius: 6
      }]
    },
    options: {
      ...baseOptions,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#334155' }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0, color: '#64748b' }, grid: { color: '#e5e7eb' } }
      }
    }
  });
}

async function loadDashboardStats() {
  try {
      const response = await fetch(`${apiBaseUrl}/api/dashboard/stats`, {
      headers: {
        Authorization: `Bearer ${state.token}`
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || 'No se pudieron cargar las estadisticas del dashboard.');
    }
    state.dashboardStats = payload;
    renderDashboardStats(payload);
  } catch (error) {
    console.error('Error cargando estadisticas del dashboard:', error);
    alert('No se pudieron cargar las graficas del dashboard.');
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
        <img src="${safeUrl(item.image_path)}" alt="Imagen de ${escapeHtml(item.serial_number)}">
      </span>
    `;
  }
  return productIcon(item?.equipment_type, size);
}

function stockMedia(item, size = 'sm') {
  if (item?.image_path) {
    return `
      <span class="equipment-photo equipment-photo--${size}">
        <img src="${safeUrl(item.image_path)}" alt="Foto de ${escapeHtml(item.name)}">
      </span>
    `;
  }
  return productIcon(item?.name, size);
}

function uiIcon(name) {
  const icons = {
    more: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/>',
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-5"/>'
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
  equipmentPreview.innerHTML = `
    <div class="hover-detail-header">
      <div>
        <span class="eyebrow">Detalles completos</span>
        <h3>${escapeHtml(item.brand)} ${escapeHtml(item.model)}</h3>
      </div>
      <button class="icon-button detail-close" type="button" data-close-preview aria-label="Cerrar">x</button>
    </div>
    <div class="detail-hero">
      <div class="equipment-art">${equipmentMedia(item, 'lg')}</div>
      <div class="detail-identity">
        <span class="detail-type">${escapeHtml(item.equipment_type)}</span>
        <strong>${escapeHtml(item.asset_tag || item.serial_number)}</strong>
        <span class="status ${escapeHtml(item.status)}">${escapeHtml(displayStatus(item.status))}</span>
      </div>
    </div>
    <div class="detail-grid">
      <article>
        <span>ID</span>
        <strong>${escapeHtml(item.id)}</strong>
      </article>
      <article>
        <span>ID de inventario</span>
        <strong>${escapeHtml(item.asset_tag || 'Sin ID')}</strong>
      </article>
      <article>
        <span>Nombre de usuario</span>
        <strong>${escapeHtml(item.assigned_user || 'Sin asignar')}</strong>
      </article>
      <article>
        <span>Numero de serie</span>
        <strong>${escapeHtml(item.serial_number)}</strong>
      </article>
      <article>
        <span>Ubicacion</span>
        <strong>${escapeHtml(item.location)}</strong>
      </article>
      <article>
        <span>Area</span>
        <strong>${escapeHtml(item.area)}</strong>
      </article>
    </div>
    <div class="detail-footer">
      <span>Actualizado ${escapeHtml(formatDate(item.updated_at))}</span>
      <button class="ghost icon-label" type="button" data-preview-open="${escapeHtml(item.id)}">${uiIcon('eye')}Abrir ficha</button>
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
  equipmentPreview.innerHTML = `
    <div class="hover-detail-header">
      <div>
        <span class="eyebrow">Detalles de stock</span>
        <h3>${escapeHtml(item.name)}</h3>
      </div>
      <button class="icon-button detail-close" type="button" data-close-preview aria-label="Cerrar">x</button>
    </div>
    <div class="detail-hero">
      <div class="equipment-art">${stockMedia(item, 'lg')}</div>
      <div class="detail-identity">
        <span class="detail-type">Stock de almacenamiento</span>
        <strong>${escapeHtml(item.item_code || item.serial_number || item.name)}</strong>
        <span class="status activo">${Number(item.quantity || 0)} disponibles</span>
      </div>
    </div>
    <div class="detail-grid">
      <article><span>ID</span><strong>${escapeHtml(item.item_code || 'Sin ID')}</strong></article>
      <article><span>Modelo</span><strong>${escapeHtml(item.model)}</strong></article>
      <article><span>Numero de serie</span><strong>${escapeHtml(item.serial_number || 'Sin serie')}</strong></article>
      <article><span>Ubicacion</span><strong>${escapeHtml(item.location)}</strong></article>
      <article><span>Area</span><strong>${escapeHtml(item.area)}</strong></article>
      <article><span>Cantidad</span><strong>${Number(item.quantity || 0)}</strong></article>
    </div>
    <div class="detail-footer">
      <span>Actualizado ${escapeHtml(formatDate(item.updated_at))}</span>
      ${canWrite ? `<button class="ghost icon-label" type="button" data-stock-preview-edit="${escapeHtml(item.id)}">${uiIcon('eye')}Modificar</button>` : ''}
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
  $('#resultCount').textContent = `Mostrando ${first}-${last} de ${meta.total} resultados`;
  $('#pageIndicator').textContent = `Pagina ${meta.page} de ${meta.total_pages}`;
  $('#prevPageButton').disabled = meta.page <= 1;
  $('#nextPageButton').disabled = meta.page >= meta.total_pages;

  state.items.forEach((item, index) => {
    const row = document.createElement('tr');
    row.dataset.itemId = item.id;
    row.classList.add('inventory-row');
    row.classList.add(`inventory-row-delay-${Math.min(index, 15)}`);
    row.innerHTML = `
      <td data-label="ID"><strong>${escapeHtml(String(item.id).slice(0, 8))}</strong></td>
      <td data-label="Tipo">
        <div class="device-cell">
          ${equipmentMedia(item)}
          <strong>${escapeHtml(item.equipment_type)}</strong>
        </div>
      </td>
      <td data-label="Marca">${escapeHtml(item.brand)}</td>
      <td data-label="Modelo">${escapeHtml(item.model)}</td>
      <td data-label="Numero de serie" data-hover-detail><strong>${escapeHtml(item.serial_number)}</strong></td>
      <td data-label="ID de inventario">${escapeHtml(item.asset_tag || 'Sin ID')}</td>
      <td data-label="Ubicacion">${escapeHtml(item.location)}</td>
      <td data-label="Area">${escapeHtml(item.area)}</td>
      <td data-label="Usuario">${escapeHtml(item.assigned_user || 'Sin asignar')}</td>
      <td data-label="Accion"><button class="ghost row-action" data-edit="${escapeHtml(item.id)}" aria-label="Ver detalle">${uiIcon('more')}</button></td>
    `;
    inventoryBody.appendChild(row);
  });

  hideHoverDetails();
  renderEquipmentTypeList();
  renderAuditView();
}

function renderEquipmentTypeList() {
  const container = $('#equipmentTypeList');
  if (!container) return;
  const totals = state.items.filter((item) => isAssetType(item.equipment_type)).reduce((acc, item) => {
    acc[item.equipment_type] = (acc[item.equipment_type] || 0) + 1;
    return acc;
  }, {});

  container.innerHTML = Object.entries(totals)
    .map(([type, total]) => `
      <article>
        ${productIcon(type, 'md')}
        <div>
          <strong>${escapeHtml(type)}</strong>
          <p>${total} activos registrados</p>
        </div>
      </article>
    `)
    .join('') || '<p class="empty-module">Sin equipos para clasificar.</p>';
}

function renderAuditView() {
  const body = $('#auditBody');
  if (!body) return;
  body.innerHTML = state.audit.map((event) => `
    <tr>
      <td><span class="audit-event">${uiIcon('shield')}${escapeHtml(event.action)}</span></td>
      <td>${escapeHtml(event.entity)} ${escapeHtml(event.entity_id || '')}<br><small>${escapeHtml(event.username || event.user_name || 'Sistema')} &middot; ${escapeHtml(formatDate(event.created_at))}</small></td>
      <td><span class="status activo">OK</span></td>
    </tr>
  `).join('') || '<tr><td colspan="3">Sin eventos de auditoria.</td></tr>';
  $('#auditResultCount').textContent = `Mostrando ${state.audit.length} eventos`;
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

  list.innerHTML = state.maintenance.map((item) => {
    const percent = phasePercent(item.phase);
    const canWrite = ['ADMIN', 'TI'].includes(state.user?.role);
    return `
      <article class="maintenance-card">
        <header>
          <div>
            <span>${escapeHtml(item.equipment_type)}</span>
            <h3>${escapeHtml(item.serial_number)} &middot; ${escapeHtml(item.brand)} ${escapeHtml(item.model)}</h3>
          </div>
          ${canWrite ? `<button class="ghost" type="button" data-maintenance-edit="${escapeHtml(item.id)}">Actualizar</button>` : ''}
        </header>
        <div class="phase-track" aria-label="Avance ${percent}%">
          <div class="phase-bar phase-${percent}"></div>
        </div>
        <div class="phase-steps">
          <span class="${percent >= 33 ? 'active' : ''}">Revisado</span>
          <span class="${percent >= 66 ? 'active' : ''}">En proceso</span>
          <span class="${percent >= 100 ? 'active' : ''}">Terminado</span>
        </div>
        <p>${escapeHtml(item.notes || 'Sin notas registradas.')}</p>
        <footer>
          <div class="maintenance-meta">
            <span>${escapeHtml(phaseLabel(item.phase))} &middot; ${percent}%</span>
            <span>${escapeHtml(item.location)} / ${escapeHtml(item.area)}</span>
            <span>Actualizado ${escapeHtml(formatDate(item.updated_at))}</span>
          </div>
        </footer>
      </article>
    `;
  }).join('') || '<p class="empty-module">Sin equipos enviados a mantenimiento.</p>';
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
  availability.innerHTML = `
    <header>
      <div>
        <span class="eyebrow">Disponibilidad</span>
        <strong>Menor a mayor por ubicacion y area</strong>
      </div>
    </header>
    <div class="availability-grid">
      ${(state.stockAvailability || []).map((item) => `
        <article>
          <span>${escapeHtml(item.location)}</span>
          <strong>${escapeHtml(item.available)}</strong>
          <small>${escapeHtml(item.area)} / ${escapeHtml(item.total)} total</small>
        </article>
      `).join('') || '<p class="empty-module">Sin disponibilidad para esta consulta.</p>'}
    </div>
  `;
  list.innerHTML = state.stock.map((item) => `
    <article class="stock-card" data-stock-id="${escapeHtml(item.id)}">
      <header>
        <div class="stock-title">
          ${stockMedia(item)}
          <div>
            <span>${escapeHtml(item.item_code || item.serial_number || 'Sin ID')}</span>
            <h3>${escapeHtml(item.name)}</h3>
          </div>
        </div>
        <div class="stock-actions">
          <strong class="quantity-pill">${Number(item.quantity || 0)} disponibles</strong>
          ${canWrite ? `<button class="ghost" type="button" data-stock-edit="${escapeHtml(item.id)}">Modificar</button>` : ''}
        </div>
      </header>
      <div class="stock-meta">
        <div><span>Ubicacion</span><strong>${escapeHtml(item.location)}</strong></div>
        <div><span>Area</span><strong>${escapeHtml(item.area)}</strong></div>
        <div><span>Modelo</span><strong>${escapeHtml(item.model)}</strong></div>
      </div>
      <p>${escapeHtml(item.notes || 'Pase el cursor para ver detalles completos.')}</p>
    </article>
  `).join('') || '<p class="empty-module">Sin dispositivos en stock para esta consulta.</p>';
}

async function loadLookups() {
  state.lookups = await api('/lookups');
  fillSelect('equipment_type_id', state.lookups.types);
  syncTypeFilterOptions();
  fillSelect('brand_id', state.lookups.brands);
  fillSelect('model_id', state.lookups.models);
  fillSelect('location_id', inventoryLocations());
  if (stockForm) fillElementSelect(stockForm.elements.location_id, inventoryLocations(), 'Seleccionar');
  syncAreaOptions();
  syncStockAreaOptions();
  initCatalogSelects();
}

function syncTypeFilterOptions() {
  if (!state.lookups) return;
  const currentValue = $('#typeFilter')?.value || '';
  const types = visibleTypesForScope(state.lookups.types);
  fillSelect('typeFilter', types, 'Todas');
  if (types.some((item) => String(item.id) === String(currentValue))) {
    $('#typeFilter').value = currentValue;
  }
}

function fillSelect(name, items, emptyLabel = 'Seleccionar') {
  const select = equipmentForm.elements[name] || stockForm?.elements[name] || $(`#${name}`);
  select.innerHTML = `<option value="">${emptyLabel}</option>`;
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
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
    select.appendChild(option);
  }
}

function setInventoryLoading(isLoading) {
  const table = $('#inventoryView .table-wrap');
  table?.classList.toggle('is-loading', isLoading);
  table?.setAttribute('aria-busy', String(isLoading));
  $('#resultCount').textContent = isLoading ? 'Cargando inventario...' : $('#resultCount').textContent;
  $('#prevPageButton').disabled = isLoading || state.inventoryMeta.page <= 1;
  $('#nextPageButton').disabled = isLoading || state.inventoryMeta.page >= state.inventoryMeta.total_pages;
}

function renderAssignedUserOptions() {
  const datalist = $('#assignedUsersList');
  if (!datalist) return;
  const users = [...new Set(state.items.map((item) => item.assigned_user).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
  datalist.replaceChildren();
  users.forEach((user) => {
    const option = document.createElement('option');
    option.value = user;
    datalist.appendChild(option);
  });
}

function syncAreaOptions() {
  if (!state.lookups) return;
  const locationId = Number(equipmentForm.elements.location_id.value);
  const areas = state.lookups.areas.filter((area) => !locationId || Number(area.location_id) === locationId);
  fillSelect('area_id', areas);
  initCatalogSelects();
}

function syncStockAreaOptions() {
  if (!state.lookups || !stockForm) return;
  const locationId = Number(stockForm.elements.location_id.value);
  const areas = state.lookups.areas.filter((area) => !locationId || Number(area.location_id) === locationId);
  const current = stockForm.elements.area_id.value;
  fillElementSelect(stockForm.elements.area_id, areas, 'Seleccionar');
  stockForm.elements.area_id.value = current;
  initCatalogSelects();
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
  const requestId = ++inventoryRequestId;
  setInventoryLoading(true);
  const search = encodeURIComponent($('#searchInput').value.trim());
  const typeId = encodeURIComponent($('#typeFilter').value);
  const status = encodeURIComponent($('#statusFilter').value);
  const page = state.inventoryMeta.page || 1;
  const limit = Number($('#pageSizeSelect').value || state.inventoryMeta.limit || 25);
  const scope = state.inventoryScope === 'all' ? '' : `&scope=${encodeURIComponent(state.inventoryScope)}`;
  try {
    const payload = await api(`/equipment?search=${search}&type_id=${typeId}&status=${status}&page=${page}&limit=${limit}${scope}`);
    if (requestId !== inventoryRequestId) return;
    state.items = payload.items;
    state.inventoryMeta = payload.meta || { page: 1, limit, total: state.items.length, total_pages: 1 };
    renderMetrics();
    renderInventory();
    renderAssignedUserOptions();
  } finally {
    if (requestId === inventoryRequestId) {
      setInventoryLoading(false);
    }
  }
}

async function loadDashboard() {
  state.dashboard = await api('/dashboard');
  renderDashboardInsights();
  await loadDashboardStats();
}

async function loadAudit() {
  if (!['ADMIN', 'TI'].includes(state.user?.role)) {
    state.audit = [];
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
  renderAuditView();
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
  const current = entry.assigned_user || entry.new_data?.assigned_user || '';
  const previous = entry.previous_assigned_user || entry.previous_data?.assigned_user || '';
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

function renderEquipmentProfile(profile) {
  const item = profile.item;
  $('#equipmentProfilePanel').classList.remove('hidden');
  $('#equipmentProfileBody').innerHTML = `
    <div><span>Proveedor</span><strong>${escapeHtml(item.supplier || 'Sin proveedor')}</strong></div>
    <div><span>Compra</span><strong>${escapeHtml(item.purchase_date ? String(item.purchase_date).slice(0, 10) : 'Sin fecha')}</strong></div>
    <div><span>Garantia</span><strong>${escapeHtml(item.warranty_until ? String(item.warranty_until).slice(0, 10) : 'Sin garantia')}</strong></div>
    <div><span>Actualizado por</span><strong>${escapeHtml(item.updated_by_name || 'Sistema')}</strong></div>
  `;
  $('#equipmentQrBox').innerHTML = profile.qr_data_url
    ? `<img src="${safeUrl(profile.qr_data_url)}" alt="QR del equipo"><a href="${safeUrl(profile.qr_url)}" target="_blank" rel="noreferrer">Abrir enlace</a>`
    : '<p class="empty-module">QR no disponible.</p>';
  $('#equipmentHistoryList').innerHTML = (profile.history || []).map((entry) => `
    <div><strong>${escapeHtml(entry.event_type)}</strong><span>${escapeHtml(historyAssignmentText(entry))} &middot; ${escapeHtml(entry.changed_by || 'Sistema')} &middot; ${escapeHtml(formatDate(entry.created_at))}</span></div>
  `).join('') || '<p class="empty-module">Sin historial.</p>';
  $('#equipmentMaintenanceList').innerHTML = (profile.maintenance || []).map((entry) => `
    <div><strong>${escapeHtml(phaseLabel(entry.phase))}</strong><span>${escapeHtml(formatDate(entry.updated_at))} &middot; ${escapeHtml(entry.notes || 'Sin notas')}</span></div>
  `).join('') || '<p class="empty-module">Sin mantenimiento.</p>';
}

async function openHardwareGroup(group) {
  state.hardwareGroup = group;
  state.inventoryMeta.page = 1;
  $('#searchInput').value = '';
  $('#statusFilter').value = '';

  const typeByGroup = {
    laptop: 'Laptop',
    monitor: 'Monitor',
    desktop: 'Desktop',
    projector: 'Projector',
    router: 'Router',
    server: 'Server',
    switch: 'Switch',
    tablet: 'Tablet',
    telefono: 'Telefono',
    ups: 'UPS',
    workstation: 'Workstation'
  };
  const typeName = typeByGroup[group];
  const type = typeName ? state.lookups.types.find((item) => item.name.toLowerCase() === typeName.toLowerCase()) : null;
  $('#typeFilter').value = type?.id || '';

  setView('inventory');
  state.inventoryScope = 'equipment';
  syncTypeFilterOptions();
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
  $('#statusFilter').value = '';
  setView('inventory');
  await loadInventory();
}

function openEquipment(item = null) {
  hideHoverDetails();
  equipmentForm.reset();
  $('#equipmentMessage').textContent = '';
  renderEquipmentImagePreview(item?.image_path || '');
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
    equipmentForm.elements.brand_id.value = brand?.id || '';
    equipmentForm.elements.model_id.value = model?.id || '';
    equipmentForm.elements.location_id.value = location?.id || '';
    syncAreaOptions();
    equipmentForm.elements.area_id.value = area?.id || '';
    equipmentForm.elements.serial_number.value = item.serial_number || '';
    equipmentForm.elements.asset_tag.value = item.asset_tag || '';
    equipmentForm.elements.assigned_user.value = item.assigned_user || '';
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
  }

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
  container.innerHTML = state.users.map((user) => `
    <article class="user-admin-item">
      <div>
        <strong>${escapeHtml(user.name)}</strong>
        <span>${escapeHtml(user.username)} &middot; ${escapeHtml(user.email)} &middot; ${escapeHtml(user.role)} &middot; ${user.is_active ? 'Activo' : 'Inactivo'}</span>
      </div>
      <div>
        <button class="ghost" type="button" data-user-edit="${escapeHtml(user.id)}">Modificar</button>
        <button class="ghost" type="button" data-user-toggle="${escapeHtml(user.id)}" data-active="${user.is_active ? 'false' : 'true'}">${user.is_active ? 'Desactivar' : 'Activar'}</button>
        <button class="ghost" type="button" data-user-reset="${escapeHtml(user.id)}">Contraseña</button>
        <button class="ghost" type="button" data-user-delete="${escapeHtml(user.id)}">Eliminar</button>
      </div>
    </article>
  `).join('') || '<p class="empty-module">Sin usuarios.</p>';
}

async function importCsvFile(file) {
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  const previewResponse = await fetch(`${apiBaseUrl}/api/equipment/import/csv?dry_run=true`, {
    method: 'POST',
    headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
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
    headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
    body: commitData
  });
  const result = await commitResponse.json().catch(() => ({}));
  if (!commitResponse.ok) throw new Error(result.message || 'No se pudo importar el CSV.');
  alert(`Importacion completa: ${result.imported} equipos.`);
  await loadLookups();
  await loadInventory();
  await loadDashboard();
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
    ['1', 'Laptop', 'Dell', 'Latitude 5450', '4WG2794', '400001', '2D', 'Sistemas', 'ALEX'],
    ['2', 'Monitor', 'Dell', 'P2425H', 'MONITOR001', '400500', 'Terminal', 'Control Tower', 'USUARIO']
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
  preview.innerHTML = src ? `<img src="${safeUrl(src)}" alt="Vista previa de imagen del equipo">` : '';
}

function renderStockImagePreview(src) {
  const preview = $('#stockImagePreview');
  if (!preview) return;
  preview.classList.toggle('hidden', !src);
  preview.innerHTML = src ? `<img src="${safeUrl(src)}" alt="Vista previa de foto de stock">` : '';
}

function fillMaintenanceEquipmentOptions(selectedId = '') {
  const select = maintenanceForm.elements.equipment_id;
  select.innerHTML = '<option value="">Seleccionar equipo</option>';
  state.items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.serial_number} - ${item.brand} ${item.model} - ${item.location}`;
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
  renderStockImagePreview(item?.image_path || '');
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

function formPayload() {
  const data = Object.fromEntries(new FormData(equipmentForm));
  delete data.id;
  delete data.image;
  return data;
}

function validateImageFile(file) {
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    throw new Error('La imagen no debe superar 2 MB.');
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Use una imagen JPG, PNG o WEBP.');
  }
}

async function uploadEquipmentImage(equipmentId) {
  const file = equipmentForm.elements.image.files[0];
  if (!file) return null;

  validateImageFile(file);

  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch(`${apiBaseUrl}/api/equipment/${equipmentId}/image`, {
    method: 'POST',
    headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
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

  validateImageFile(file);

  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch(`${apiBaseUrl}/api/stock/${stockId}/image`, {
    method: 'POST',
    headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
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
              <option value="${escapeHtml(brand.id)}" ${String(brand.id) === String(equipmentForm.elements.brand_id.value) ? 'selected' : ''}>${escapeHtml(brand.name)}</option>
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
              <option value="${escapeHtml(location.id)}" ${String(location.id) === String(activeLocationId) ? 'selected' : ''}>${escapeHtml(location.name)}</option>
            `).join('')}
          </select>
        </label>
        <label class="wide">Area nueva<input name="name" required minlength="2" maxlength="120" placeholder="Ej. Soporte TI"></label>
      `
    },
    assigned_user: {
      title: 'Agregar nombre de usuario',
      html: '<label class="wide">Nombre de usuario<input name="assigned_user" required minlength="2" maxlength="140" placeholder="Ej. ALEX"></label>'
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
    }

    if (type === 'brand') {
      const payload = await api('/lookups/brands', {
        method: 'POST',
        body: JSON.stringify({ name: data.name })
      });
      await loadLookups();
      equipmentForm.elements.brand_id.value = String(payload.brand.id);
    }

    if (type === 'model') {
      const payload = await api('/lookups/models', {
        method: 'POST',
        body: JSON.stringify({ brand_id: data.brand_id, name: data.name })
      });
      await loadLookups();
      equipmentForm.elements.brand_id.value = String(payload.model.brand_id);
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

    if (type === 'assigned_user') {
      equipmentForm.elements.assigned_user.value = data.assigned_user;
    }

    if (type === 'serial') {
      equipmentForm.elements.serial_number.value = data.serial_number;
    }

    catalogDialog.close();
    const label = data.name || data.assigned_user || data.serial_number;
    $('#equipmentMessage').textContent = `${label} listo para guardarse en la base de datos.`;
  } catch (error) {
    $('#catalogMessage').textContent = error.message;
  }
}

async function exportInventoryPdf() {
  const params = new URLSearchParams({
    search: $('#searchInput').value.trim(),
    type_id: $('#typeFilter').value,
    status: $('#statusFilter').value
  });
  if (state.inventoryScope !== 'all') {
    params.set('scope', state.inventoryScope);
  }
  const response = await fetch(`${apiBaseUrl}/api/equipment/export/pdf?${params.toString()}`, {
    headers: state.token ? { Authorization: `Bearer ${state.token}` } : {}
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

async function boot() {
  loginView.classList.add('hidden');
  dashboardView.classList.add('hidden');

  // Al recargar o abrir la URL, limpiar la sesión
  // para forzar siempre el inicio de sesión.
  state.token = null;
  state.user = null;
  clearAuthSession();

  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (e) {}

  showLogin();
}

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#loginMessage').textContent = '';
  try {
    const credentials = Object.fromEntries(new FormData(event.currentTarget));
    const rememberUsername = Boolean(credentials.remember_username);
    delete credentials.remember_username;
    const payload = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    state.token = payload.token;
    state.user = payload.user;
    saveAuthSession();
    if (rememberUsername) {
      localStorage.setItem('sati_remember_username', credentials.username);
    } else {
      localStorage.removeItem('sati_remember_username');
    }
    showDashboard();
    await loadLookups();
    await loadInventory();
    await loadDashboard();
    await loadMaintenance();
  } catch (error) {
    $('#loginMessage').textContent = error.message;
    if (error.message.includes('codigo') || error.message.includes('contrasena')) {
      $('#resetPanel').classList.remove('hidden');
    }
  }
});

$('#forgotPasswordLink').addEventListener('click', (event) => {
  event.preventDefault();
  $('#resetPanel').classList.remove('hidden');
  $('#loginMessage').textContent = '';
});

$('#passwordToggle').addEventListener('click', () => {
  const passwordInput = $('#loginForm').elements.password;
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  $('#passwordToggle').setAttribute('aria-label', isPassword ? 'Ocultar contrasena' : 'Mostrar contrasena');
});

$('#requestResetButton').addEventListener('click', async () => {
  $('#loginMessage').textContent = '';
  try {
    const username = $('#loginForm').elements.username.value;
    const payload = await api('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
    $('#loginMessage').textContent = payload.devCode
      ? `${payload.message} Codigo dev: ${payload.devCode}`
      : payload.message;
  } catch (error) {
    $('#loginMessage').textContent = error.message;
  }
});

$('#confirmResetButton').addEventListener('click', async () => {
  $('#loginMessage').textContent = '';
  try {
    const form = $('#loginForm');
    const payload = await api('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({
        username: form.elements.username.value,
        code: form.elements.reset_code.value,
        password: form.elements.reset_password.value
      })
    });
    $('#loginMessage').textContent = payload.message;
    $('#resetPanel').classList.add('hidden');
  } catch (error) {
    $('#loginMessage').textContent = error.message;
  }
});

$('#logoutButton').addEventListener('click', () => {
  state.token = null;
  state.user = null;
  state.items = [];
  state.lookups = null;
  state.maintenance = [];
  state.stock = [];
  clearAuthSession();
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
sidebarCollapseButton.addEventListener('click', toggleSidebar);

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

$('#backButton').addEventListener('click', returnToInventory);

document.querySelectorAll('[data-back-inventory]').forEach((button) => {
  button.addEventListener('click', returnToInventory);
});

$('#newEquipmentButton').addEventListener('click', () => openEquipment());
$('#newMaintenanceButton').addEventListener('click', () => openMaintenance());
$('#newStockButton').addEventListener('click', openStockDialog);
$('#newUserButton').addEventListener('click', () => {
  userForm.reset();
  userForm.dataset.userId = '';
  if (userForm.elements.username) userForm.elements.username.disabled = false;
  if (userForm.elements.password) userForm.elements.password.required = true;
  $('#userMessage').textContent = '';
  userDialog.showModal();
  loadUsers();
});

$('#changePasswordButton').addEventListener('click', () => {
  passwordForm.reset();
  $('#passwordMessage').textContent = '';
  passwordDialog.showModal();
});

equipmentForm.elements.location_id.addEventListener('change', syncAreaOptions);
stockForm.elements.location_id.addEventListener('change', syncStockAreaOptions);

equipmentForm.elements.image.addEventListener('change', () => {
  const file = equipmentForm.elements.image.files[0];
  if (!file) {
    const item = state.items.find((entry) => entry.id === equipmentForm.elements.id.value);
    renderEquipmentImagePreview(item?.image_path || '');
    return;
  }
  renderEquipmentImagePreview(URL.createObjectURL(file));
});

stockForm.elements.image.addEventListener('change', () => {
  const file = stockForm.elements.image.files[0];
  if (!file) {
    const item = state.stock.find((entry) => entry.id === stockForm.elements.id.value);
    renderStockImagePreview(item?.image_path || '');
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

function syncTriggerValue(select, trigger) {
  const option = select.options[select.selectedIndex];
  trigger.textContent = option ? option.textContent : 'Seleccionar';
  trigger.classList.toggle('placeholder', !select.value);
}

function initCatalogSelects() {
  document.querySelectorAll('.catalog-select-wrap select').forEach((select) => {
    const wrap = select.closest('.catalog-select-wrap');
    if (wrap.querySelector('.catalog-select-trigger')) return;

    select.style.display = 'none';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'catalog-select-trigger placeholder';
    trigger.textContent = 'Seleccionar';

    const dropdown = document.createElement('div');
    dropdown.className = 'catalog-select-dropdown';

    function renderOptions() {
      dropdown.innerHTML = '';
      const kind = select.getAttribute('data-catalog-kind') || ({ equipment_type_id: 'type', brand_id: 'brand', model_id: 'model', location_id: 'location', area_id: 'area' })[select.name] || select.name.replace(/_id$/, '');
      const idField = select.name;
      const items = state.lookups ? getCatalogItems(select) : [];

      items.forEach((item) => {
        const opt = document.createElement('div');
        opt.className = 'catalog-select-option';
        if (String(item.id) === select.value) opt.classList.add('selected');

        const label = document.createElement('span');
        label.textContent = item.name;

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'catalog-select-option-delete';
        delBtn.textContent = 'x';
        delBtn.title = 'Eliminar';

        delBtn.addEventListener('click', async (event) => {
          event.stopPropagation();
          if (!confirm(`Eliminar "${item.name}"?`)) return;
          try {
            await api(`/lookups/${kind}/${item.id}`, { method: 'DELETE' });
            await loadLookups();
            dropdown.classList.remove('open');
            trigger.classList.remove('open');
          } catch (error) {
            alert(error.message);
          }
        });

        opt.addEventListener('click', () => {
          select.value = item.id;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          syncTriggerValue(select, trigger);
          dropdown.querySelector('.selected')?.classList.remove('selected');
          opt.classList.add('selected');
          dropdown.classList.remove('open');
          trigger.classList.remove('open');
        });

        opt.appendChild(label);
        opt.appendChild(delBtn);
        dropdown.appendChild(opt);
      });
    }

    trigger.addEventListener('click', () => {
      renderOptions();
      dropdown.classList.toggle('open');
      trigger.classList.toggle('open');
    });

    document.addEventListener('click', (event) => {
      if (!wrap.contains(event.target)) {
        dropdown.classList.remove('open');
        trigger.classList.remove('open');
      }
    });

    select.addEventListener('change', () => syncTriggerValue(select, trigger));

    wrap.appendChild(trigger);
    wrap.appendChild(dropdown);
    syncTriggerValue(select, trigger);
  });
}

function getCatalogItems(kind, select) {
  if (select.name === 'area_id') {
    const form = select.closest('form');
    const locationId = Number(form?.elements?.location_id?.value);
    return state.lookups.areas.filter((area) => !locationId || Number(area.location_id) === locationId);
  }
  if (select.name === 'location_id') return inventoryLocations();
  const map = {
    equipment_type_id: state.lookups.types,
    brand_id: state.lookups.brands,
    model_id: state.lookups.models
  };
  return map[select.name] || [];
}

document.querySelectorAll('nav a[data-view]').forEach((link) => {
  link.addEventListener('click', async (event) => {
    event.preventDefault();
    setView(link.dataset.view);
    if (['inventory', 'equipment', 'accessories'].includes(link.dataset.view)) {
      state.hardwareGroup = null;
      state.inventoryMeta.page = 1;
      $('#searchInput').value = '';
      $('#typeFilter').value = '';
      $('#statusFilter').value = '';
      await loadInventory();
    }
  });
});

$('#searchInput').addEventListener('input', () => {
  state.hardwareGroup = null;
  state.inventoryMeta.page = 1;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadInventory, 250);
});

$('#typeFilter').addEventListener('change', () => {
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
  state.inventoryMeta.page = 1;
  loadInventory();
});

$('#exportPdfButton').addEventListener('click', async () => {
  try {
    await exportInventoryPdf();
  } catch (error) {
    alert(error.message);
  }
});

$('#downloadTemplateButton').addEventListener('click', downloadImportTemplate);

$('#importCsvButton').addEventListener('click', () => $('#csvImportInput').click());

$('#csvImportInput').addEventListener('change', async () => {
  try {
    await importCsvFile($('#csvImportInput').files[0]);
  } catch (error) {
    alert(error.message);
  } finally {
    $('#csvImportInput').value = '';
  }
});

$('#applyAuditFiltersButton').addEventListener('click', loadAudit);

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
    headers: state.token ? { Authorization: `Bearer ${state.token}` } : {}
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    alert(payload.message || 'No se pudo exportar auditoria.');
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
});

$('#maintenanceList').addEventListener('click', (event) => {
  const button = event.target.closest('[data-maintenance-edit]');
  if (!button) return;
  const item = state.maintenance.find((entry) => entry.id === button.dataset.maintenanceEdit);
  openMaintenance(item);
});

$('#hardwareView').addEventListener('click', async (event) => {
  const option = event.target.closest('[data-hardware-group]');
  if (!option) return;
  await openHardwareGroup(option.dataset.hardwareGroup);
});

$('#hardwareView').addEventListener('keydown', async (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  const option = event.target.closest('[data-hardware-group]');
  if (!option) return;
  event.preventDefault();
  await openHardwareGroup(option.dataset.hardwareGroup);
});

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

window.addEventListener('resize', () => {
  if (equipmentPreview.classList.contains('equipment-preview--visible')) {
    positionHoverDetails();
  }
});

$('#saveEquipmentButton').addEventListener('click', async () => {
  $('#equipmentMessage').textContent = '';
  if (!equipmentForm.reportValidity()) return;

  try {
    const id = equipmentForm.elements.id.value;
    const payload = await api(id ? `/equipment/${id}` : '/equipment', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(formPayload())
    });
    await uploadEquipmentImage(id || payload.item.id);
    equipmentDialog.close();
    await loadInventory();
    await loadDashboard();
  } catch (error) {
    $('#equipmentMessage').textContent = error.message;
  }
});

$('#deleteButton').addEventListener('click', async () => {
  const id = equipmentForm.elements.id.value;
  if (!id || !confirm('Eliminar este equipo del inventario?')) return;

  try {
    await api(`/equipment/${id}`, { method: 'DELETE' });
    equipmentDialog.close();
    await loadInventory();
    await loadDashboard();
  } catch (error) {
    $('#equipmentMessage').textContent = error.message;
  }
});

$('#saveMaintenanceButton').addEventListener('click', async () => {
  $('#maintenanceMessage').textContent = '';
  if (!maintenanceForm.reportValidity()) return;

  try {
    const id = maintenanceForm.elements.id.value;
    await api(id ? `/maintenance/${id}` : '/maintenance', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(maintenancePayload())
    });
    maintenanceForm.elements.equipment_id.disabled = false;
    maintenanceDialog.close();
    await loadMaintenance();
    await loadInventory();
    await loadDashboard();
  } catch (error) {
    $('#maintenanceMessage').textContent = error.message;
  }
});

$('#saveStockButton').addEventListener('click', async () => {
  $('#stockMessage').textContent = '';
  if (!stockForm.reportValidity()) return;
  try {
    const id = stockForm.elements.id.value;
    const payload = await api(id ? `/stock/${id}` : '/stock', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(stockPayload())
    });
    await uploadStockImage(id || payload.item.id);
    stockDialog.close();
    await loadStock();
    await loadDashboard();
  } catch (error) {
    $('#stockMessage').textContent = error.message;
  }
});

maintenanceDialog.addEventListener('close', () => {
  maintenanceForm.elements.equipment_id.disabled = false;
});

$('#saveUserButton').addEventListener('click', async () => {
  $('#userMessage').textContent = '';
  if (!userForm.reportValidity()) return;

  try {
    const userId = userForm.dataset.userId;
    const formData = Object.fromEntries(new FormData(userForm));

    if (userId) {
      const updateData = { name: formData.name, email: formData.email, role: formData.role };
      await api(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(updateData) });
      
      if (formData.password) {
        await api(`/users/${userId}/password`, {
          method: 'POST',
          body: JSON.stringify({ password: formData.password })
        });
      }
    } else {
      await api('/users', { method: 'POST', body: JSON.stringify(formData) });
    }

    userForm.reset();
    userDialog.close();
    await loadUsers();
  } catch (error) {
    $('#userMessage').textContent = error.message;
  }
});

$('#userAdminList').addEventListener('click', async (event) => {
  const toggle = event.target.closest('[data-user-toggle]');
  const reset = event.target.closest('[data-user-reset]');
  const edit = event.target.closest('[data-user-edit]');
  const del = event.target.closest('[data-user-delete]');
  try {
    if (toggle) {
      await api(`/users/${toggle.dataset.userToggle}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: toggle.dataset.active === 'true' })
      });
      await loadUsers();
    }
    if (reset) {
      const password = prompt('Nueva contrasena maxima de 12 caracteres:');
      if (!password) return;
      await api(`/users/${reset.dataset.userReset}/password`, {
        method: 'POST',
        body: JSON.stringify({ password })
      });
      alert('Contrasena reiniciada.');
    }
    if (edit) {
      const user = state.users.find((u) => u.id === edit.dataset.userEdit);
      if (user) {
        userForm.reset();
        userForm.dataset.userId = user.id;
        if (userForm.elements.name) userForm.elements.name.value = user.name;
        if (userForm.elements.username) {
          userForm.elements.username.value = user.username;
          userForm.elements.username.disabled = true;
        }
        if (userForm.elements.email) userForm.elements.email.value = user.email;
        if (userForm.elements.role) userForm.elements.role.value = user.role;
        if (userForm.elements.password) userForm.elements.password.required = false;
        $('#userMessage').textContent = '';
        userDialog.showModal();
      }
    }
    if (del) {
      if (!confirm('¿Está seguro de eliminar este usuario permanentemente?')) return;
      await api(`/users/${del.dataset.userDelete}`, { method: 'DELETE' });
      await loadUsers();
    }
  } catch (error) {
    alert(error.message);
  }
});

$('#savePasswordButton').addEventListener('click', async () => {
  $('#passwordMessage').textContent = '';
  if (!passwordForm.reportValidity()) return;
  try {
    const payload = await api('/auth/password', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(passwordForm)))
    });
    $('#passwordMessage').textContent = payload.message;
    passwordForm.reset();
  } catch (error) {
    $('#passwordMessage').textContent = error.message;
  }
});

boot();
