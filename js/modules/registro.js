import { db } from '../db/db.js';
import { auth } from '../auth.js';
import { toast } from '../app.js';
import { formatMoney } from '../utils/format.js';

let containerElement = null;
let searchTimeout = null;
let selectedClient = null;
let isNewClient = false;
let services = [];
let employees = [];
let turnoId = null;

export async function render(container) {
    containerElement = container;
    
    // Check if we came from a reservation
    const hash = window.location.hash;
    if (hash.includes('?turno=')) {
        const urlParams = new URLSearchParams(hash.split('?')[1]);
        turnoId = urlParams.get('turno');
    } else {
        turnoId = null;
    }

    container.innerHTML = `
        <div class="registro-rapido">
            <h2 class="page-title">Registro Rápido</h2>
            
            <form id="registro-form" class="registro-form">
                <!-- Paso 1: Cliente -->
                <section class="form-section card">
                    <h3 class="section-title">1. Buscar o Crear Cliente</h3>
                    
                    <div id="client-search-container" class="search-container">
                        <label for="search-client">Buscar por nombre, teléfono o patente</label>
                        <input type="text" id="search-client" class="form-input" autocomplete="off" placeholder="Ej: Juan, 351..., AB123CD" style="min-height: 48px;">
                        <ul id="search-results" class="dropdown-results hidden"></ul>
                    </div>
                    
                    <!-- Banner de cliente existente -->
                    <div id="existing-client-banner" class="banner banner-success hidden">
                        <p><strong>Cliente existente</strong> — se agregará un nuevo lavado a su historial.</p>
                        <p id="existing-client-name" class="highlight-name"></p>
                        <button type="button" id="btn-change-client" class="btn btn-outline" style="margin-top: 10px; min-height: 48px;">Cambiar Cliente</button>
                    </div>

                    <!-- Formulario de nuevo cliente -->
                    <div id="new-client-form" class="new-client-form hidden">
                        <h4 style="margin-bottom: 10px; color: var(--color-dorado, #c9a227);">Nuevo Cliente</h4>
                        <div class="form-group">
                            <label for="new-client-name">Nombre completo</label>
                            <input type="text" id="new-client-name" class="form-input" required style="min-height: 48px;">
                        </div>
                        <div class="form-group">
                            <label for="new-client-phone">Teléfono</label>
                            <input type="tel" id="new-client-phone" class="form-input" required style="min-height: 48px;">
                        </div>
                        <div class="form-group">
                            <label for="new-client-patente">Patente (Opcional)</label>
                            <input type="text" id="new-client-patente" class="form-input" style="min-height: 48px;">
                        </div>
                        <button type="button" id="btn-cancel-new-client" class="btn btn-outline" style="margin-top: 10px; min-height: 48px;">Cancelar</button>
                    </div>
                </section>

                <!-- Paso 2: Servicio -->
                <section class="form-section card">
                    <h3 class="section-title">2. Configurar el Servicio</h3>
                    
                    <div class="form-group">
                        <label>Tipo de Vehículo</label>
                        <div class="vehicle-types">
                            <label class="vehicle-card">
                                <input type="radio" name="vehicle-type" value="auto" required>
                                <span class="vehicle-content">
                                    🚗 Auto<br><small>60 min</small>
                                </span>
                            </label>
                            <label class="vehicle-card">
                                <input type="radio" name="vehicle-type" value="camioneta">
                                <span class="vehicle-content">
                                    🚙 Camioneta / Familiar<br><small>90 min</small>
                                </span>
                            </label>
                            <label class="vehicle-card">
                                <input type="radio" name="vehicle-type" value="4x4">
                                <span class="vehicle-content">
                                    🚜 4x4 / Pick-up<br><small>120 min</small>
                                </span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Servicio</label>
                        <div id="services-container" class="services-grid">
                            <!-- Los servicios se cargarán dinámicamente -->
                        </div>
                        <input type="hidden" id="selected-service-id" required>
                    </div>
                    
                    <div class="form-group" id="employee-selector-group">
                        <label for="empleado-select">Asignar a Empleado</label>
                        <select id="empleado-select" class="form-input" required style="min-height: 48px;">
                            <!-- Empleados se cargarán dinámicamente -->
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="notas">Notas (Opcional)</label>
                        <textarea id="notas" class="form-input" maxlength="200" rows="3" placeholder="Detalles adicionales..." style="min-height: 48px;"></textarea>
                    </div>
                </section>

                <div class="form-actions" style="margin-top: 20px;">
                    <button type="submit" id="btn-submit" class="btn btn-primary btn-lg" style="width: 100%; min-height: 60px; font-size: 1.2rem;">Agregar a la cola de hoy</button>
                </div>
            </form>
        </div>
        
        <style>
            .registro-rapido { max-width: 800px; margin: 0 auto; }
            .form-section { margin-bottom: 20px; padding: 20px; border-radius: 8px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .search-container { position: relative; }
            .dropdown-results { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #ddd; z-index: 10; max-height: 250px; overflow-y: auto; list-style: none; padding: 0; margin: 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .dropdown-item { padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; min-height: 48px; display: flex; flex-direction: column; justify-content: center; }
            .dropdown-item:hover { background: #f5f0e8; }
            .dropdown-item-new { color: var(--color-dorado, #c9a227); font-weight: bold; }
            .banner { padding: 15px; border-radius: 4px; margin-bottom: 15px; }
            .banner-success { background: #e8f5e9; border: 1px solid #c8e6c9; color: #2e7d32; }
            .highlight-name { font-size: 1.2rem; font-family: 'Playfair Display', serif; margin: 5px 0 0 0; color: #000; }
            .hidden { display: none !important; }
            
            .vehicle-types { display: flex; gap: 10px; flex-wrap: wrap; }
            .vehicle-card { flex: 1; min-width: 120px; cursor: pointer; }
            .vehicle-card input[type="radio"] { display: none; }
            .vehicle-content { display: block; padding: 15px; border: 2px solid #ddd; border-radius: 8px; text-align: center; transition: all 0.2s; min-height: 48px; }
            .vehicle-card input[type="radio"]:checked + .vehicle-content { border-color: var(--color-dorado, #c9a227); background: #f5f0e8; font-weight: bold; }
            
            .services-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
            .service-card { border: 2px solid #ddd; border-radius: 8px; padding: 15px; cursor: pointer; transition: all 0.2s; min-height: 80px; display: flex; flex-direction: column; justify-content: space-between; }
            .service-card.selected { border-color: var(--color-dorado, #c9a227); background: #f5f0e8; }
            .service-title { font-weight: bold; margin-bottom: 5px; }
            .service-price { color: var(--color-dorado, #c9a227); font-weight: bold; font-size: 1.1em; }
            .service-desc { font-size: 0.85em; color: #666; margin-top: 5px; }
            
            .btn-outline { background: transparent; border: 1px solid currentColor; color: inherit; }
            .btn-lg { padding: 15px 30px; }
        </style>
    `;
}

export async function init() {
    await loadInitialData();
    setupEventListeners();
    
    // Check if coming from a turno to prefill client info if possible
    if (turnoId) {
        await prefillFromTurno(turnoId);
    }
}

async function loadInitialData() {
    try {
        // Mock default services if DB is empty for demo purposes, 
        // normally you fetch these from DB
        services = await db.getAll('servicios');
        if (services.length === 0) {
            services = [
                { id: '1', nombre: 'Lavado Básico', precio: 15000, descripcion: 'Exterior e interior básico' },
                { id: '2', nombre: 'Lavado Premium', precio: 30000, descripcion: 'Encerado y limpieza profunda' },
                { id: '3', nombre: 'Tratamiento Acrílico', precio: 80000, descripcion: 'Brillo y protección por 6 meses' }
            ];
            // En una app real los guardaríamos en DB primero
        }
        
        renderServices();

        employees = await db.getAll('empleados') || [];
        // Filtramos solo activos
        employees = employees.filter(e => e.activo !== false);
        
        // Mock if empty
        if (employees.length === 0) {
            employees = [
                { id: 'emp1', nombre: 'Carlos' },
                { id: 'emp2', nombre: 'Miguel' }
            ];
        }

        const currentEmployee = auth.getCurrentUser();
        const empSelect = document.getElementById('empleado-select');
        const empGroup = document.getElementById('employee-selector-group');

        empSelect.innerHTML = '<option value="">Seleccione un empleado...</option>';

        if (currentEmployee && currentEmployee.role === 'empleado') {
            // Empleado asignado a sí mismo
            empSelect.innerHTML = `<option value="${currentEmployee.id}" selected>${currentEmployee.nombre}</option>`;
            empSelect.disabled = true;
        } else {
            // Dueño o admin
            employees.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = emp.nombre;
                empSelect.appendChild(opt);
            });
            empSelect.disabled = false;
        }
    } catch (err) {
        console.error('Error cargando datos iniciales:', err);
        toast('Error al cargar servicios y empleados', 'error');
    }
}

function renderServices() {
    const container = document.getElementById('services-container');
    container.innerHTML = '';
    
    services.forEach(srv => {
        const div = document.createElement('div');
        div.className = 'service-card';
        div.dataset.id = srv.id;
        div.innerHTML = `
            <div>
                <div class="service-title">${srv.nombre}</div>
                <div class="service-price">${formatMoney(srv.precio)}</div>
            </div>
            ${srv.descripcion ? `<div class="service-desc">${srv.descripcion}</div>` : ''}
        `;
        
        div.addEventListener('click', () => {
            // Remove selected from all
            document.querySelectorAll('.service-card').forEach(el => el.classList.remove('selected'));
            // Add to current
            div.classList.add('selected');
            document.getElementById('selected-service-id').value = srv.id;
        });
        
        container.appendChild(div);
    });
}

function setupEventListeners() {
    const searchInput = document.getElementById('search-client');
    const searchResults = document.getElementById('search-results');
    const form = document.getElementById('registro-form');
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim().toLowerCase();
        
        if (query.length < 2) {
            searchResults.classList.add('hidden');
            return;
        }
        
        searchTimeout = setTimeout(() => performSearch(query), 300);
    });
    
    document.getElementById('btn-change-client').addEventListener('click', () => {
        resetClientSelection();
    });
    
    document.getElementById('btn-cancel-new-client').addEventListener('click', () => {
        resetClientSelection();
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#client-search-container')) {
            searchResults.classList.add('hidden');
        }
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleSubmit();
    });
}

async function performSearch(query) {
    try {
        const clientes = await db.getAll('clientes') || [];
        
        const results = clientes.filter(c => 
            (c.nombre && c.nombre.toLowerCase().includes(query)) ||
            (c.telefono && c.telefono.includes(query)) ||
            (c.patente && c.patente.toLowerCase().includes(query))
        ).slice(0, 5); // Limit to 5
        
        renderSearchResults(results, query);
    } catch (err) {
        console.error('Error buscando clientes:', err);
    }
}

function renderSearchResults(results, query) {
    const resultsList = document.getElementById('search-results');
    resultsList.innerHTML = '';
    
    if (results.length > 0) {
        results.forEach(client => {
            const li = document.createElement('li');
            li.className = 'dropdown-item';
            const patenteText = client.patente ? ` - Patente: ${client.patente.toUpperCase()}` : '';
            li.innerHTML = `<strong>${client.nombre}</strong><br><small>Tel: ${client.telefono || 'N/A'}${patenteText}</small>`;
            li.addEventListener('click', () => selectClient(client));
            resultsList.appendChild(li);
        });
    }
    
    // Always show "Add new" option
    const liNew = document.createElement('li');
    liNew.className = 'dropdown-item dropdown-item-new';
    liNew.innerHTML = `+ Registrar como cliente nuevo: "${query}"`;
    liNew.addEventListener('click', () => showNewClientForm(query));
    resultsList.appendChild(liNew);
    
    resultsList.classList.remove('hidden');
}

function selectClient(client) {
    selectedClient = client;
    isNewClient = false;
    
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('client-search-container').classList.add('hidden');
    document.getElementById('new-client-form').classList.add('hidden');
    
    const banner = document.getElementById('existing-client-banner');
    document.getElementById('existing-client-name').textContent = `${client.nombre} (Tel: ${client.telefono || '-'})`;
    banner.classList.remove('hidden');
}

function showNewClientForm(query) {
    selectedClient = null;
    isNewClient = true;
    
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('client-search-container').classList.add('hidden');
    document.getElementById('existing-client-banner').classList.add('hidden');
    
    const newForm = document.getElementById('new-client-form');
    newForm.classList.remove('hidden');
    
    // Attempt to prefill if query looks like a phone or plate
    const nameInput = document.getElementById('new-client-name');
    const phoneInput = document.getElementById('new-client-phone');
    const patenteInput = document.getElementById('new-client-patente');
    
    nameInput.value = '';
    phoneInput.value = '';
    patenteInput.value = '';
    
    if (/^\d+$/.test(query)) {
        phoneInput.value = query;
    } else if (query.length >= 6 && query.length <= 7 && !query.includes(' ')) {
        patenteInput.value = query.toUpperCase();
    } else {
        nameInput.value = query;
    }
    
    nameInput.focus();
}

function resetClientSelection() {
    selectedClient = null;
    isNewClient = false;
    
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('existing-client-banner').classList.add('hidden');
    document.getElementById('new-client-form').classList.add('hidden');
    
    const searchContainer = document.getElementById('client-search-container');
    searchContainer.classList.remove('hidden');
    
    const searchInput = document.getElementById('search-client');
    searchInput.value = '';
    searchInput.focus();
}

async function prefillFromTurno(id) {
    try {
        const turno = await db.get('turnos', id);
        if (turno) {
            let client = null;
            if (turno.clienteId) {
                client = await db.get('clientes', turno.clienteId);
            }
            if (client) {
                selectClient(client);
            } else if (turno.clienteNombre) {
                showNewClientForm(turno.clienteNombre);
                if (turno.telefono) {
                    document.getElementById('new-client-phone').value = turno.telefono;
                }
            }
        }
    } catch (err) {
        console.error('Error prefilling from turno:', err);
    }
}

async function handleSubmit() {
    try {
        // Validaciones manuales extra
        if (!selectedClient && !isNewClient) {
            toast('Debe seleccionar o crear un cliente.', 'error');
            return;
        }

        const serviceId = document.getElementById('selected-service-id').value;
        if (!serviceId) {
            toast('Debe seleccionar un servicio.', 'error');
            return;
        }

        let clientId = null;
        let clientName = '';

        // Manejar Cliente
        if (isNewClient) {
            const name = document.getElementById('new-client-name').value.trim();
            const phone = document.getElementById('new-client-phone').value.trim();
            const patente = document.getElementById('new-client-patente').value.trim();
            
            const newClient = {
                id: 'cli_' + Date.now(),
                nombre: name,
                telefono: phone,
                patente: patente,
                fechaAlta: new Date().toISOString()
            };
            await db.add('clientes', newClient);
            clientId = newClient.id;
            clientName = newClient.nombre;
        } else {
            clientId = selectedClient.id;
            clientName = selectedClient.nombre;
        }

        // Recuperar datos del servicio
        const vehicleType = document.querySelector('input[name="vehicle-type"]:checked').value;
        const employeeId = document.getElementById('empleado-select').value;
        const notes = document.getElementById('notas').value.trim();
        const service = services.find(s => s.id === serviceId);

        // Crear registro de lavado
        const nuevoLavado = {
            id: 'lav_' + Date.now(),
            clienteId: clientId,
            clienteNombre: clientName,
            empleadoId: employeeId,
            servicioId: serviceId,
            servicioNombre: service.nombre,
            precio: service.precio,
            tipoVehiculo: vehicleType,
            notas: notes,
            estado: 'en_espera',
            fechaInicio: new Date().toISOString(),
            turnoId: turnoId // Si viene de un turno
        };

        await db.add('lavados', nuevoLavado);

        // Si venía de un turno, marcarlo completado
        if (turnoId) {
            const turno = await db.get('turnos', turnoId);
            if (turno) {
                turno.estado = 'completado';
                await db.put('turnos', turno);
            }
        }

        toast('¡Vehículo agregado a la cola! Ahora está en espera.', 'success');
        
        // Reset form
        document.getElementById('registro-form').reset();
        document.querySelectorAll('.service-card').forEach(el => el.classList.remove('selected'));
        document.getElementById('selected-service-id').value = '';
        resetClientSelection();
        
        // Limpiar URL si había turno
        if (turnoId) {
            turnoId = null;
            window.location.hash = '#/registro';
        }

    } catch (err) {
        console.error('Error al registrar lavado:', err);
        toast('Ocurrió un error al registrar el lavado.', 'error');
    }
}
