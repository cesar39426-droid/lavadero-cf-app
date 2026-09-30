import { db } from '../db/db.js';
import { formatMoney, formatDate, getTimeSlots, isSunday, getNextAvailableDays } from '../utils/format.js';
import { downloadICS } from '../utils/calendar.js';
import {
    VEHICLE_CATEGORIES,
    VEHICLE_CATEGORY_META,
    categoryFromLegacyType,
    formatVehicleName,
    getServicePrice,
    getVehicleCategoryMeta,
    legacyTypeForCategory,
    searchVehicles
} from '../data/vehiculos.js';

let currentStep = 1;
let currentContainer = null;
let debounceTimer = null;

let bookingData = {
    servicioId: null,
    servicioNombre: '',
    tipoVehiculo: null,
    vehiculoMarca: '',
    vehiculoModelo: '',
    vehiculoCategoria: null,
    fecha: null,
    hora: null,
    clienteId: null,
    clienteNombre: '',
    clienteTelefono: '',
    precio: 0
};

export async function render(container) {
    currentContainer = container;
    container.innerHTML = `
        <div class="turnos-module">
            <div class="turnos-header">
                <img src="assets/logo.jpg" alt="LavaderoCF" class="turnos-logo" onerror="this.style.display='none'">
                <h2>Reservá tu turno</h2>
            </div>
            
            <div class="stepper-progress" id="stepper-progress">
                <span id="step-indicator" class="step-indicator-text">Paso 1 de 3 — Servicio</span>
                <div class="progress-track">
                    <div class="progress-fill" id="progress-fill" style="width: 33.33%;"></div>
                </div>
            </div>

            <div id="step-1" class="step-container"></div>
            <div id="step-2" class="step-container" style="display:none;"></div>
            <div id="step-3" class="step-container" style="display:none;"></div>
            <div id="step-success" class="step-container" style="display:none;"></div>
        </div>
    `;
    
    injectStyles();
}

export async function init() {
    currentStep = 1;
    resetBookingData();

    // Check URL parameters
    const hashParts = window.location.hash.split('?');
    if (hashParts.length > 1) {
        const urlParams = new URLSearchParams(hashParts[1]);
        const prefillClienteId = urlParams.get('cliente');
        const prefillServicioId = urlParams.get('servicio');
        
        if (prefillClienteId) {
            try {
                const cliente = await db.get('clientes', Number(prefillClienteId));
                if (cliente) {
                    bookingData.clienteId = cliente.id;
                    bookingData.clienteNombre = cliente.nombre;
                    bookingData.clienteTelefono = cliente.telefono;
                }
            } catch (error) {
                console.error("Error cargando cliente prefijado", error);
            }
        }
        if (prefillServicioId) {
            bookingData.servicioId = Number(prefillServicioId);
        }
    }

    await renderStep1();
}

function resetBookingData() {
    bookingData = {
        servicioId: null,
        servicioNombre: '',
        tipoVehiculo: null,
        vehiculoMarca: '',
        vehiculoModelo: '',
        vehiculoCategoria: null,
        fecha: null,
        hora: null,
        clienteId: null,
        clienteNombre: '',
        clienteTelefono: '',
        precio: 0
    };
}

function updateProgress() {
    if (currentStep > 3) {
        document.getElementById('stepper-progress').style.display = 'none';
        return;
    }
    document.getElementById('stepper-progress').style.display = 'block';
    const titles = ["Servicio", "Fecha y Horario", "Tus Datos"];
    document.getElementById('step-indicator').textContent = `Paso ${currentStep} de 3 — ${titles[currentStep-1]}`;
    document.getElementById('progress-fill').style.width = `${(currentStep / 3) * 100}%`;

    // Hide all, show current
    [1, 2, 3, 'success'].forEach(step => {
        const el = document.getElementById(`step-${step}`);
        if (el) el.style.display = 'none';
    });
    const currentEl = document.getElementById(`step-${currentStep}`);
    if (currentEl) currentEl.style.display = 'block';
}

async function renderStep1() {
    const container = document.getElementById('step-1');
    updateProgress();
    
    let servicios = [];
    try {
        servicios = await db.getAll('servicios');
    } catch (e) {
        // Fallback for empty db
        servicios = [
            { id: 1, nombre: 'Lavado Premium', descripcion: 'Interior y exterior a detalle', precio: 30000 },
            { id: 2, nombre: 'Lavado Básico', descripcion: 'Lavado exterior rápido', precio: 15000 }
        ];
    }

    const selectedCategory = bookingData.vehiculoCategoria || categoryFromLegacyType(bookingData.tipoVehiculo);
    bookingData.vehiculoCategoria = bookingData.tipoVehiculo ? selectedCategory : null;
    const categoryMeta = bookingData.vehiculoCategoria ? getVehicleCategoryMeta(bookingData.vehiculoCategoria) : null;
    const selectedVehicleLabel = bookingData.vehiculoMarca && bookingData.vehiculoModelo
        ? `${bookingData.vehiculoMarca} ${bookingData.vehiculoModelo}`
        : '';

    let html = `
        <div class="vehiculo-selector">
            <h3>¿Qué vehículo vas a traer?</h3>
            <p class="selector-help">Buscá marca o modelo para calcular el precio exacto.</p>
            <div class="vehicle-search-wrap">
                <span class="vehicle-search-icon" aria-hidden="true">⌕</span>
                <input id="vehicle-search" class="vehicle-search-input" type="search" autocomplete="off"
                    placeholder="Ej: Suran, T-Cross, Hilux..." value="${selectedVehicleLabel}">
                <div id="vehicle-suggestions" class="vehicle-suggestions" role="listbox" aria-label="Vehículos sugeridos"></div>
            </div>
            <div id="selected-vehicle" class="selected-vehicle" ${selectedVehicleLabel ? '' : 'hidden'}>
                <span class="selected-vehicle-icon">${categoryMeta?.icon || '🚗'}</span>
                <span><strong>${selectedVehicleLabel || 'Vehículo seleccionado'}</strong><small>${categoryMeta?.label || ''}</small></span>
                <button type="button" id="clear-vehicle" class="clear-vehicle" aria-label="Cambiar vehículo">Cambiar</button>
            </div>
            <div class="fallback-heading">¿No encontrás tu modelo? Elegí la categoría:</div>
            <div class="vehiculo-options">
                ${Object.entries(VEHICLE_CATEGORY_META).map(([category, meta]) => `
                    <button type="button" class="btn-vehiculo ${bookingData.vehiculoCategoria === category && !selectedVehicleLabel ? 'selected' : ''}" data-category="${category}">
                        <span class="vehicle-card-icon">${meta.icon}</span><strong>${meta.shortLabel}</strong><small>${meta.label.replace(meta.shortLabel, '').replace(/^ \/ /, '')}</small>
                    </button>
                `).join('')}
            </div>
            <p id="vehicle-selection-hint" class="vehicle-selection-hint">Seleccioná un vehículo o una categoría para continuar.</p>
        </div>
        
        <div class="servicio-selector">
            <h3>Seleccioná el Servicio</h3>
            <div class="servicio-list">
                ${servicios.map(s => {
                    const price = getServicePrice(s, bookingData.vehiculoCategoria);
                    return `
                    <div class="card-servicio ${bookingData.servicioId === s.id ? 'selected' : ''}" data-id="${s.id}" data-nombre="${s.nombre}" data-precio="${price}">
                        <div class="servicio-info">
                            <h4>${s.nombre}</h4>
                            <p>${s.descripcion || s.desc || ''}</p>
                        </div>
                        <div class="servicio-precio">${bookingData.vehiculoCategoria ? formatMoney(price) : 'Elegí vehículo'}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>

        <button id="btn-next-1" class="btn-primary mt-4" disabled>Siguiente</button>
    `;
    
    container.innerHTML = html;

    // Event Listeners Step 1
    const checkStep1Complete = () => {
        document.getElementById('btn-next-1').disabled = !(bookingData.vehiculoCategoria && bookingData.servicioId);
        const hint = document.getElementById('vehicle-selection-hint');
        if (hint) hint.textContent = bookingData.vehiculoCategoria
            ? `Categoría: ${getVehicleCategoryMeta(bookingData.vehiculoCategoria).label}. Los precios se actualizaron.`
            : 'Seleccioná un vehículo o una categoría para continuar.';
    };

    const selectCategory = (category, vehicle = null) => {
        bookingData.vehiculoCategoria = category;
        bookingData.tipoVehiculo = legacyTypeForCategory(category);
        bookingData.vehiculoMarca = vehicle?.marca || '';
        bookingData.vehiculoModelo = vehicle?.modelo || '';
        if (bookingData.servicioId) {
            const service = servicios.find(s => s.id === bookingData.servicioId);
            if (service) bookingData.precio = getServicePrice(service, category);
        }
        renderStep1();
    };

    const searchInput = document.getElementById('vehicle-search');
    const suggestions = document.getElementById('vehicle-suggestions');
    const renderSuggestions = () => {
        const matches = searchVehicles(searchInput.value);
        suggestions.innerHTML = matches.length ? matches.map(vehicle => `
            <button type="button" class="vehicle-suggestion" data-vehicle-id="${vehicle.id}" role="option">
                <span>${getVehicleCategoryMeta(vehicle.categoria).icon}</span>
                <span><strong>${vehicle.marca} ${vehicle.modelo}</strong><small>${getVehicleCategoryMeta(vehicle.categoria).label}</small></span>
            </button>
        `).join('') : (searchInput.value.trim() ? '<p class="no-vehicle-results">No encontramos ese modelo. Probá con otra búsqueda o elegí una categoría abajo.</p>' : '');
        suggestions.hidden = !searchInput.value.trim();
        suggestions.querySelectorAll('.vehicle-suggestion').forEach(button => {
            button.addEventListener('click', () => {
                const vehicle = searchVehicles(searchInput.value).find(item => item.id === button.dataset.vehicleId);
                if (vehicle) selectCategory(vehicle.categoria, vehicle);
            });
        });
    };
    searchInput.addEventListener('input', renderSuggestions);
    searchInput.addEventListener('focus', renderSuggestions);
    document.getElementById('clear-vehicle')?.addEventListener('click', () => {
        bookingData.vehiculoMarca = '';
        bookingData.vehiculoModelo = '';
        bookingData.vehiculoCategoria = null;
        bookingData.tipoVehiculo = null;
        renderStep1();
    });

    container.querySelectorAll('.btn-vehiculo').forEach(btn => {
        btn.addEventListener('click', (e) => {
            selectCategory(e.currentTarget.dataset.category);
        });
    });

    container.querySelectorAll('.card-servicio').forEach(card => {
        card.addEventListener('click', (e) => {
            container.querySelectorAll('.card-servicio').forEach(c => c.classList.remove('selected'));
            const target = e.currentTarget;
            target.classList.add('selected');
            bookingData.servicioId = Number(target.dataset.id);
            bookingData.servicioNombre = target.dataset.nombre;
            const service = servicios.find(s => s.id === bookingData.servicioId);
            bookingData.precio = getServicePrice(service, bookingData.vehiculoCategoria);
            checkStep1Complete();
        });
    });

    document.getElementById('btn-next-1').addEventListener('click', async () => {
        currentStep = 2;
        await renderStep2();
    });

    checkStep1Complete();
}

async function renderStep2() {
    const container = document.getElementById('step-2');
    updateProgress();

    // Generate next 4 days
    const nextDays = getNextAvailableDays ? getNextAvailableDays(4) : generateFallbackDays(4);
    if (!bookingData.fecha) {
        bookingData.fecha = nextDays[0].fechaRaw; // default to first
    }

    container.innerHTML = `
        <button class="btn-secondary btn-back" id="btn-back-1">← Volver</button>
        <div class="dias-selector">
            <h3>Día</h3>
            <div class="dias-tabs">
                ${nextDays.map(d => `
                    <button class="btn-dia ${bookingData.fecha === d.fechaRaw ? 'selected' : ''}" data-fecha="${d.fechaRaw}">
                        ${d.fechaCorta}
                    </button>
                `).join('')}
            </div>
        </div>
        
        <div class="horarios-selector">
            <h3>Horario</h3>
            <div id="horarios-grid" class="horarios-grid">
                <!-- Se llena via JS -->
            </div>
        </div>

        <button id="btn-next-2" class="btn-primary mt-4" disabled>Siguiente</button>
    `;

    document.getElementById('btn-back-1').addEventListener('click', async () => {
        currentStep = 1;
        await renderStep1();
    });

    const checkStep2Complete = () => {
        document.getElementById('btn-next-2').disabled = !(bookingData.fecha && bookingData.hora);
    };

    container.querySelectorAll('.btn-dia').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            container.querySelectorAll('.btn-dia').forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            bookingData.fecha = e.currentTarget.dataset.fecha;
            bookingData.hora = null;
            await updateHorarios();
            checkStep2Complete();
        });
    });

    document.getElementById('btn-next-2').addEventListener('click', async () => {
        currentStep = 3;
        await renderStep3();
    });

    await updateHorarios();
    checkStep2Complete();
}

async function updateHorarios() {
    const grid = document.getElementById('horarios-grid');
    grid.innerHTML = '<p>Cargando horarios...</p>';

    // Calcular duración según vehículo
    let duracionMin = 60;
    if (bookingData.tipoVehiculo === 'Camioneta-Familiar') duracionMin = 90;
    if (bookingData.tipoVehiculo === '4x4') duracionMin = 120;

    // Obtener turnos existentes para esa fecha
    let turnosDelDia = [];
    try {
        const turnos = typeof db.getTurnosByFecha === 'function'
            ? await db.getTurnosByFecha(bookingData.fecha)
            : await db.getAll('turnos');
        turnosDelDia = turnos.filter(t => t.fecha === bookingData.fecha && t.estado !== 'cancelado');
    } catch (e) {
        console.error("No se pudieron cargar turnos del día", e);
    }

    // Generar slots
    const isDomingo = isSunday ? isSunday(bookingData.fecha) : new Date(bookingData.fecha + 'T00:00:00').getDay() === 0;
    const startHour = isDomingo ? 9 : 8;
    const endHour = isDomingo ? 16 : 17;

    const slots = [];
    let currentMin = startHour * 60;
    const endMin = endHour * 60;

    while (currentMin + duracionMin <= endMin) {
        const h = Math.floor(currentMin / 60);
        const m = currentMin % 60;
        const horaStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        
        // Simple overlap check
        const isOccupied = turnosDelDia.some(t => {
            if (!t.hora) return false;
            const tMin = parseInt(t.hora.split(':')[0]) * 60 + parseInt(t.hora.split(':')[1]);
            // asume turnos previos duran 60 min para simplificar si no se guarda la duracion
            return currentMin < tMin + 60 && tMin < currentMin + duracionMin;
        });

        if (!isOccupied) {
            slots.push(horaStr);
        }
        currentMin += duracionMin;
    }

    if (slots.length === 0) {
        grid.innerHTML = '<p class="text-muted">No hay horarios disponibles para este día.</p>';
        return;
    }

    grid.innerHTML = slots.map(s => `
        <button class="btn-hora ${bookingData.hora === s ? 'selected' : ''}" data-hora="${s}">
            ${s}
        </button>
    `).join('');

    grid.querySelectorAll('.btn-hora').forEach(btn => {
        btn.addEventListener('click', (e) => {
            grid.querySelectorAll('.btn-hora').forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            bookingData.hora = e.currentTarget.dataset.hora;
            document.getElementById('btn-next-2').disabled = false;
        });
    });
}

async function renderStep3() {
    const container = document.getElementById('step-3');
    updateProgress();

    container.innerHTML = `
        <button class="btn-secondary btn-back" id="btn-back-2">← Volver</button>
        <div class="datos-form">
            <h3>Tus Datos</h3>
            <div id="cliente-banner" class="banner-bienvenida" style="display:none;"></div>
            
            <div class="form-group">
                <label for="cliente-telefono">Teléfono</label>
                <input type="tel" id="cliente-telefono" class="form-control" placeholder="Ej: 11 1234 5678" value="${bookingData.clienteTelefono}">
            </div>
            <div class="form-group">
                <label for="cliente-nombre">Nombre Completo</label>
                <input type="text" id="cliente-nombre" class="form-control" placeholder="Ej: Juan Pérez" value="${bookingData.clienteNombre}">
            </div>
        </div>
        
        <div class="resumen-reserva">
            <h4>Resumen</h4>
            <p><strong>Vehículo:</strong> ${formatVehicleName(bookingData.vehiculoMarca && bookingData.vehiculoModelo ? { marca: bookingData.vehiculoMarca, modelo: bookingData.vehiculoModelo } : null)}</p>
            <p><strong>Categoría:</strong> ${getVehicleCategoryMeta(bookingData.vehiculoCategoria || categoryFromLegacyType(bookingData.tipoVehiculo)).label}</p>
            <p><strong>Servicio:</strong> ${bookingData.servicioNombre || 'Lavado seleccionado'}</p>
            <p><strong>Día:</strong> ${formatDate ? formatDate(bookingData.fecha) : bookingData.fecha} a las ${bookingData.hora}</p>
            <p><strong>Total a pagar:</strong> ${formatMoney ? formatMoney(bookingData.precio) : '$' + bookingData.precio}</p>
        </div>

        <button id="btn-confirmar" class="btn-primary mt-4" disabled>Confirmar Reserva</button>
    `;

    document.getElementById('btn-back-2').addEventListener('click', async () => {
        currentStep = 2;
        await renderStep2();
    });

    const checkStep3Complete = () => {
        const t = document.getElementById('cliente-telefono').value.trim();
        const n = document.getElementById('cliente-nombre').value.trim();
        document.getElementById('btn-confirmar').disabled = !(t && n);
    };

    document.getElementById('cliente-telefono').addEventListener('input', (e) => {
        bookingData.clienteTelefono = e.target.value;
        checkStep3Complete();

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const tel = e.target.value.trim();
            if (tel.length >= 8) {
                try {
                    const clientes = await db.getAll('clientes');
                    const clienteExistente = clientes.find(c => c.telefono.replace(/\D/g,'') === tel.replace(/\D/g,''));
                    if (clienteExistente) {
                        bookingData.clienteId = clienteExistente.id;
                        document.getElementById('cliente-nombre').value = clienteExistente.nombre;
                        bookingData.clienteNombre = clienteExistente.nombre;
                        
                        const banner = document.getElementById('cliente-banner');
                        banner.innerHTML = `¡Bienvenido de vuelta, <strong>${clienteExistente.nombre}</strong>! Tus datos ya están en nuestro sistema.`;
                        banner.style.display = 'block';
                        checkStep3Complete();
                    } else {
                        bookingData.clienteId = null;
                        document.getElementById('cliente-banner').style.display = 'none';
                    }
                } catch(err) {
                    console.error("Error buscando cliente", err);
                }
            }
        }, 500);
    });

    document.getElementById('cliente-nombre').addEventListener('input', (e) => {
        bookingData.clienteNombre = e.target.value;
        checkStep3Complete();
    });

    document.getElementById('btn-confirmar').addEventListener('click', async () => {
        document.getElementById('btn-confirmar').disabled = true;
        document.getElementById('btn-confirmar').textContent = 'Procesando...';
        await procesarReserva();
    });

    checkStep3Complete();
    
    if(bookingData.clienteNombre) {
        document.getElementById('cliente-banner').innerHTML = `¡Bienvenido de vuelta, <strong>${bookingData.clienteNombre}</strong>!`;
        document.getElementById('cliente-banner').style.display = 'block';
    }
}

async function procesarReserva() {
    try {
        // Create client if new
        if (!bookingData.clienteId) {
            const nuevoClienteId = await db.add('clientes', {
                nombre: bookingData.clienteNombre,
                telefono: bookingData.clienteTelefono,
                fechaRegistro: new Date().toISOString()
            });
            bookingData.clienteId = nuevoClienteId;
        } else {
            // Update client name if changed
            const cliente = await db.get('clientes', bookingData.clienteId);
            if (cliente && cliente.nombre !== bookingData.clienteNombre) {
                cliente.nombre = bookingData.clienteNombre;
                await db.put('clientes', cliente);
            }
        }

        // Create turno
        const nuevoTurno = {
            clienteId: bookingData.clienteId,
            clienteNombre: bookingData.clienteNombre,
            clienteTelefono: bookingData.clienteTelefono,
            servicioId: bookingData.servicioId,
            tipoVehiculo: bookingData.tipoVehiculo,
            vehiculoMarca: bookingData.vehiculoMarca,
            vehiculoModelo: bookingData.vehiculoModelo,
            vehiculoCategoria: bookingData.vehiculoCategoria,
            fecha: bookingData.fecha,
            hora: bookingData.hora,
            estado: 'pendiente',
            precio: bookingData.precio,
            fechaCreacion: new Date().toISOString()
        };

        await db.add('turnos', nuevoTurno);

        currentStep = 'success';
        await renderSuccess();
    } catch (e) {
        console.error("Error procesando reserva:", e);
        alert("Hubo un error al guardar tu reserva. Por favor intentá de nuevo.");
        document.getElementById('btn-confirmar').disabled = false;
        document.getElementById('btn-confirmar').textContent = 'Confirmar Reserva';
    }
}

async function renderSuccess() {
    const container = document.getElementById('step-success');
    document.getElementById('stepper-progress').style.display = 'none';
    
    // hide step-3 manually since updateProgress won't do it if currentStep > 3
    document.getElementById('step-3').style.display = 'none';
    container.style.display = 'flex';

    container.innerHTML = `
        <div class="success-content">
            <div class="check-icon">✓</div>
            <h2>¡Tu turno está reservado!</h2>
            <div class="resumen-final">
                <p><strong>Vehículo:</strong> ${formatVehicleName(bookingData.vehiculoMarca && bookingData.vehiculoModelo ? { marca: bookingData.vehiculoMarca, modelo: bookingData.vehiculoModelo } : null)}</p>
                <p><strong>Categoría:</strong> ${getVehicleCategoryMeta(bookingData.vehiculoCategoria || categoryFromLegacyType(bookingData.tipoVehiculo)).label}</p>
                <p><strong>Servicio:</strong> ${bookingData.servicioNombre || 'Lavado seleccionado'}</p>
                <p><strong>Día:</strong> ${formatDate ? formatDate(bookingData.fecha) : bookingData.fecha}</p>
                <p><strong>Hora:</strong> ${bookingData.hora}</p>
                <p><strong>Total:</strong> ${formatMoney ? formatMoney(bookingData.precio) : '$' + bookingData.precio}</p>
            </div>
            
            <div class="success-actions">
                <button id="btn-calendar" class="btn-outline">📅 Agregar al calendario</button>
                <button id="btn-home" class="btn-primary mt-3">Volver al inicio</button>
            </div>
        </div>
    `;

    document.getElementById('btn-calendar').addEventListener('click', () => {
        if (downloadICS) {
            downloadICS({
                title: `Turno LavaderoCF - ${bookingData.servicioNombre}`,
                description: `Reserva para ${bookingData.tipoVehiculo}.`,
                date: bookingData.fecha,
                time: bookingData.hora,
                duration: bookingData.tipoVehiculo === '4x4' ? 120 : (bookingData.tipoVehiculo === 'Camioneta-Familiar' ? 90 : 60)
            });
        } else {
            alert('Función de calendario no disponible.');
        }
    });

    document.getElementById('btn-home').addEventListener('click', () => {
        init();
    });
}

function generateFallbackDays(count) {
    const days = [];
    const today = new Date();
    const nombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for(let i=0; i<count; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i + 1); // start tomorrow
        days.push({
            fechaRaw: d.toISOString().split('T')[0],
            fechaCorta: `${nombres[d.getDay()]}, ${d.getDate()} ${d.toLocaleString('es-AR', {month: 'short'})}`
        });
    }
    return days;
}

function injectStyles() {
    if (document.getElementById('turnos-styles')) return;
    const style = document.createElement('style');
    style.id = 'turnos-styles';
    style.textContent = `
        .turnos-module {
            max-width: 600px;
            margin: 0 auto;
            padding: 24px;
            font-family: 'Inter', sans-serif;
            color: #f5f0e8;
            background-color: #000000;
            min-height: 100vh;
        }
        .turnos-header {
            text-align: center;
            margin-bottom: 32px;
        }
        .turnos-logo {
            width: 120px;
            border-radius: 8px;
            margin-bottom: 16px;
        }
        .turnos-header h2 {
            font-family: 'Playfair Display', serif;
            color: #c9a227;
            font-size: 28px;
            margin: 0;
        }
        .stepper-progress {
            margin-bottom: 32px;
        }
        .step-indicator-text {
            display: block;
            font-size: 14px;
            color: #c9a227;
            margin-bottom: 8px;
            text-align: right;
        }
        .progress-track {
            height: 4px;
            background: #333;
            border-radius: 2px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            background: #c9a227;
            transition: width 0.3s ease;
        }
        .vehiculo-selector, .servicio-selector, .dias-selector, .horarios-selector {
            margin-bottom: 24px;
        }
        .selector-help, .vehicle-selection-hint {
            color: #aaa;
            font-size: 13px;
            margin: -8px 0 14px;
        }
        .vehicle-search-wrap { position: relative; margin-bottom: 12px; }
        .vehicle-search-icon {
            position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
            color: #aaa; font-size: 20px; pointer-events: none;
        }
        .vehicle-search-input {
            width: 100%; min-height: 52px; padding: 14px 16px 14px 42px;
            background: #1a1a1a; border: 1px solid #333; border-radius: 8px;
            color: #f5f0e8; font-size: 16px; box-sizing: border-box;
        }
        .vehicle-search-input:focus { outline: none; border-color: #c9a227; }
        .vehicle-suggestions {
            position: absolute; z-index: 5; left: 0; right: 0; top: 56px;
            background: #1a1a1a; border: 1px solid #c9a227; border-radius: 8px;
            overflow: hidden; box-shadow: 0 10px 24px rgba(0,0,0,.35);
        }
        .vehicle-suggestion {
            width: 100%; display: flex; gap: 10px; align-items: center; text-align: left;
            padding: 12px 14px; background: transparent; color: #f5f0e8;
            border: 0; border-bottom: 1px solid #333; cursor: pointer;
        }
        .vehicle-suggestion:last-child { border-bottom: 0; }
        .vehicle-suggestion:hover, .vehicle-suggestion:focus { background: #252525; outline: none; }
        .vehicle-suggestion strong, .vehicle-suggestion small, .selected-vehicle small { display: block; }
        .vehicle-suggestion small, .selected-vehicle small { color: #aaa; font-size: 12px; margin-top: 2px; }
        .no-vehicle-results { padding: 12px 14px; color: #aaa; font-size: 13px; line-height: 1.4; margin: 0; }
        .selected-vehicle {
            display: flex; align-items: center; gap: 10px; padding: 12px;
            background: rgba(201,162,39,.12); border: 1px solid #c9a227; border-radius: 8px; margin-bottom: 14px;
        }
        .selected-vehicle[hidden] { display: none; }
        .selected-vehicle-icon { font-size: 25px; }
        .clear-vehicle { margin-left: auto; background: transparent; color: #c9a227; font-size: 12px; cursor: pointer; }
        .fallback-heading { color: #ccc; font-size: 13px; margin-bottom: 8px; }
        h3 {
            font-size: 18px;
            margin-bottom: 16px;
            color: #f5f0e8;
            font-weight: 500;
        }
        .vehiculo-options {
            display: flex;
            gap: 12px;
        }
        .btn-vehiculo, .btn-dia, .btn-hora {
            flex: 1;
            background: #1a1a1a;
            border: 1px solid #333;
            color: #f5f0e8;
            padding: 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 14px;
            min-height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .btn-vehiculo { flex-direction: column; gap: 4px; text-align: center; }
        .btn-vehiculo strong { font-size: 13px; }
        .btn-vehiculo small { color: #aaa; font-size: 11px; line-height: 1.2; }
        .vehicle-card-icon { font-size: 24px; }
        .dias-tabs {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 8px;
        }
        .btn-dia {
            flex: 0 0 calc(25% - 6px);
            padding: 12px 8px;
            text-align: center;
        }
        .horarios-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 12px;
        }
        .btn-vehiculo.selected, .btn-dia.selected, .btn-hora.selected, .card-servicio.selected {
            border-color: #c9a227;
            background: rgba(201, 162, 39, 0.1);
            color: #c9a227;
        }
        .card-servicio {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            transition: all 0.2s;
        }
        .servicio-info h4 {
            margin: 0 0 4px 0;
            font-size: 16px;
        }
        .servicio-info p {
            margin: 0;
            font-size: 13px;
            color: #aaa;
        }
        .servicio-precio {
            font-weight: 600;
            color: #c9a227;
            font-size: 16px;
        }
        .btn-primary, .btn-secondary, .btn-outline {
            width: 100%;
            padding: 16px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            min-height: 48px;
            transition: opacity 0.2s;
        }
        .btn-primary {
            background: #c9a227;
            color: #000;
        }
        .btn-primary:disabled {
            background: #555;
            color: #888;
            cursor: not-allowed;
        }
        .btn-secondary {
            background: transparent;
            color: #c9a227;
            text-align: left;
            padding: 0 0 16px 0;
            width: auto;
        }
        .btn-outline {
            background: transparent;
            border: 1px solid #c9a227;
            color: #c9a227;
        }
        .mt-4 { margin-top: 32px; }
        .mt-3 { margin-top: 16px; }
        
        .datos-form .form-group {
            margin-bottom: 20px;
        }
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            color: #ccc;
        }
        .form-control {
            width: 100%;
            background: #1a1a1a;
            border: 1px solid #333;
            padding: 14px 16px;
            border-radius: 8px;
            color: #f5f0e8;
            font-size: 16px;
            min-height: 48px;
            box-sizing: border-box;
        }
        .form-control:focus {
            outline: none;
            border-color: #c9a227;
        }
        .banner-bienvenida {
            background: rgba(201, 162, 39, 0.15);
            border: 1px solid #c9a227;
            color: #c9a227;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 24px;
            font-size: 14px;
            line-height: 1.4;
        }
        .resumen-reserva {
            background: #111;
            padding: 16px;
            border-radius: 8px;
            margin-top: 32px;
            border: 1px dashed #333;
        }
        .resumen-reserva h4 { margin: 0 0 12px 0; color: #c9a227; }
        .resumen-reserva p { margin: 0 0 8px 0; font-size: 14px; color: #ccc; }
        
        .success-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding-top: 40px;
        }
        .check-icon {
            width: 80px;
            height: 80px;
            background: #c9a227;
            color: #000;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            margin-bottom: 24px;
            animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes popIn {
            0% { transform: scale(0); }
            100% { transform: scale(1); }
        }
        .success-content h2 {
            font-family: 'Playfair Display', serif;
            color: #c9a227;
            margin: 0 0 24px 0;
            font-size: 28px;
        }
        .resumen-final {
            background: #111;
            padding: 24px;
            border-radius: 8px;
            width: 100%;
            text-align: left;
            margin-bottom: 32px;
            border: 1px solid #333;
        }
        .resumen-final p {
            margin: 0 0 12px 0;
            font-size: 15px;
            display: flex;
            justify-content: space-between;
        }
        .success-actions {
            width: 100%;
        }
    `;
    document.head.appendChild(style);
}
