import { db } from '../db/db.js';
import { auth } from '../auth.js';
import { toast } from '../utils/toast.js';
import { formatMoney, formatDateTime } from '../utils/format.js';
import { whatsappListo, openWhatsApp } from '../utils/whatsapp.js';

let currentContainer = null;
let timerInterval = null;
let refreshInterval = null;
let currentWashes = [];

export async function render(container) {
    currentContainer = container;
    container.innerHTML = `
        <div class="vehiculos-dia-container">
            <header class="page-header">
                <h1 id="vd-title">Vehículos del Día</h1>
                <p id="vd-date" class="subtitle"></p>
                <div class="status-counters">
                    <span class="counter-badge espera" id="count-espera">0 en cola</span>
                    <span class="counter-badge proceso" id="count-proceso">0 en proceso</span>
                    <span class="counter-badge listo" id="count-listo">0 listos</span>
                </div>
            </header>
            
            <div id="vehiculos-list" class="vehiculos-list">
                <!-- Se llena dinámicamente -->
            </div>
        </div>
    `;

    updateDateHeader();
    await loadVehicles();
}

export async function init() {
    // Iniciar timer en vivo
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimers, 1000);

    // Auto-refresh cada 30 segundos
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadVehicles, 30000);

    // Actualizar al volver a la pestaña
    document.addEventListener("visibilitychange", handleVisibilityChange);
}

function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        loadVehicles();
    }
}

function updateDateHeader() {
    const today = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateStr = today.toLocaleDateString('es-AR', options);
    const capitalizedDateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    
    const dateEl = document.getElementById('vd-date');
    if (dateEl) {
        dateEl.textContent = capitalizedDateStr;
    }
}

async function loadVehicles() {
    if (!currentContainer) return;
    
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Asumiendo que el store se llama 'lavados'
        const allWashes = await db.getAll('lavados'); 
        currentWashes = allWashes.filter(w => {
            const washDate = new Date(w.fechaIngreso);
            return washDate >= today;
        });

        renderVehiclesList();
        updateCounters();
    } catch (error) {
        console.error('Error al cargar vehículos:', error);
        toast('Error al cargar la lista de vehículos', 'error');
    }
}

function updateCounters() {
    const espera = currentWashes.filter(w => w.estado === 'en_espera').length;
    const proceso = currentWashes.filter(w => w.estado === 'en_proceso').length;
    const listos = currentWashes.filter(w => w.estado === 'listo').length;

    const elEspera = document.getElementById('count-espera');
    const elProceso = document.getElementById('count-proceso');
    const elListo = document.getElementById('count-listo');

    if (elEspera) elEspera.textContent = `${espera} en cola`;
    if (elProceso) elProceso.textContent = `${proceso} en proceso`;
    if (elListo) elListo.textContent = `${listos} listos`;
}

function renderVehiclesList() {
    const listEl = document.getElementById('vehiculos-list');
    if (!listEl) return;

    if (currentWashes.length === 0) {
        const userRole = auth.getUser()?.rol || 'empleado';
        const registerRoute = userRole === 'dueno' ? '#/dueno/registro' : '#/empleado/registro';
        
        listEl.innerHTML = `
            <div class="empty-state">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#c9a227" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L16 11l-2.7-3.6a2 2 0 00-1.6-.8H9.3a2 2 0 00-1.6.8L5 11l-5.16.86a1 1 0 00-.84.99V16h3m12 0a2 2 0 11-4 0 2 2 0 014 0zM9 16a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                <p>Ningún vehículo registrado hoy. ¡El día está esperando!</p>
                <a href="${registerRoute}" class="btn btn-primary">Registrar primer vehículo</a>
            </div>
        `;
        return;
    }

    // Sort: En espera -> En proceso -> Listo
    const statusOrder = { 'en_espera': 1, 'en_proceso': 2, 'listo': 3 };
    const sortedWashes = currentWashes.sort((a, b) => statusOrder[a.estado] - statusOrder[b.estado]);

    listEl.innerHTML = sortedWashes.map(w => generateVehicleCard(w)).join('');

    // Agregar event listeners a los botones
    sortedWashes.forEach(w => {
        const btnIniciar = document.getElementById(`btn-iniciar-${w.id}`);
        if (btnIniciar) {
            btnIniciar.addEventListener('click', () => changeWashStatus(w.id, 'en_proceso'));
        }

        const btnListo = document.getElementById(`btn-listo-${w.id}`);
        if (btnListo) {
            btnListo.addEventListener('click', () => markAsReady(w));
        }
        
        const btnAvisar = document.getElementById(`btn-avisar-${w.id}`);
        if (btnAvisar) {
            btnAvisar.addEventListener('click', () => openWhatsAppModal(w));
        }

        const btnCancel = document.getElementById(`btn-cancel-${w.id}`);
        if (btnCancel) {
            btnCancel.addEventListener('click', () => cancelWash(w.id));
        }
    });
}

function generateVehicleCard(wash) {
    const user = auth.getUser();
    const canCancel = user?.rol === 'dueno';
    
    let statusChipClass = '';
    let statusText = '';
    let actionButton = '';

    const iconType = wash.tipoVehiculo === 'camioneta' ? '🚙' : '🚗';

    if (wash.estado === 'en_espera') {
        statusChipClass = 'chip-espera';
        statusText = 'En Espera';
        actionButton = `<button class="btn btn-primary" id="btn-iniciar-${wash.id}">Iniciar</button>`;
    } else if (wash.estado === 'en_proceso') {
        statusChipClass = 'chip-proceso blink';
        statusText = 'En Proceso';
        actionButton = `<button class="btn btn-primary" id="btn-listo-${wash.id}">Marcar como Listo</button>`;
    } else if (wash.estado === 'listo') {
        statusChipClass = 'chip-listo';
        statusText = 'Listo';
        actionButton = `<button class="btn btn-whatsapp" id="btn-avisar-${wash.id}">💬 Avisar al cliente</button>`;
    }

    return `
        <div class="vehicle-card" data-id="${wash.id}">
            <div class="vehicle-card-header">
                <div class="vehicle-title">
                    <span class="vehicle-icon">${iconType}</span>
                    <h3>${wash.clienteNombre || 'Cliente Local'}</h3>
                </div>
                <div class="vehicle-status">
                    <span class="chip ${statusChipClass}">${statusText}</span>
                    ${canCancel ? `<button class="btn-icon" id="btn-cancel-${wash.id}" title="Cancelar lavado">❌</button>` : ''}
                </div>
            </div>
            <div class="vehicle-card-body">
                <div class="vehicle-info-row">
                    <span class="plate" style="font-family: monospace; font-size: 1.2rem; font-weight: bold; padding: 4px 8px; background: #eee; border-radius: 4px; display: inline-block;">${wash.patente}</span>
                    <span class="timer" data-start="${wash.estado === 'en_proceso' ? wash.fechaInicio : wash.fechaIngreso}" data-state="${wash.estado}">00:00:00</span>
                </div>
                <div class="vehicle-details" style="margin-top: 10px;">
                    <p><strong>Servicio:</strong> ${wash.servicioNombre} - ${formatMoney(wash.precio)}</p>
                    <p><strong>Asignado a:</strong> ${wash.empleadoNombre || 'Sin asignar'}</p>
                </div>
            </div>
            <div class="vehicle-card-actions" style="margin-top: 15px;">
                ${actionButton}
            </div>
        </div>
    `;
}

async function changeWashStatus(id, newStatus) {
    try {
        const wash = await db.get('lavados', id);
        wash.estado = newStatus;
        if (newStatus === 'en_proceso') {
            wash.fechaInicio = new Date().toISOString();
        }
        await db.put('lavados', wash);
        toast(`Estado actualizado a ${newStatus}`, 'success');
        loadVehicles();
    } catch (e) {
        console.error(e);
        toast('Error al actualizar el estado', 'error');
    }
}

async function markAsReady(wash) {
    try {
        wash.estado = 'listo';
        wash.fechaFin = new Date().toISOString();
        await db.put('lavados', wash);
        toast('Vehículo marcado como listo', 'success');
        loadVehicles();
        openWhatsAppModal(wash);
    } catch (e) {
        console.error(e);
        toast('Error al actualizar el estado', 'error');
    }
}

function cancelWash(id) {
    showConfirmModal(
        '¿Estás seguro de que querés cancelar este lavado? Esta acción no se puede deshacer.',
        async () => {
            try {
                await db.delete('lavados', id);
                toast('Lavado cancelado y eliminado', 'success');
                loadVehicles();
            } catch (e) {
                console.error(e);
                toast('Error al cancelar el lavado', 'error');
            }
        }
    );
}

function openWhatsAppModal(wash) {
    const defaultMsg = whatsappListo(wash.clienteNombre || 'Cliente');
    
    const modalHtml = `
        <div class="modal-backdrop" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
            <div class="modal-content" style="background: white; padding: 20px; border-radius: 8px; width: 90%; max-width: 400px; text-align: center;">
                <h2>¡Vehículo Listo! 🚗✨</h2>
                <p>El lavado de <strong>${wash.patente}</strong> está terminado.</p>
                <div class="msg-preview" style="background: #f5f0e8; padding: 10px; border-radius: 6px; margin: 15px 0;">
                    <em>${defaultMsg}</em>
                </div>
                <div class="modal-actions" style="display: flex; flex-direction: column; gap: 10px;">
                    <button id="btn-wa-send" class="btn btn-whatsapp" style="padding: 12px; font-size: 1.1rem; background: #25D366; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        Abrir WhatsApp
                    </button>
                    <button id="btn-wa-skip" class="btn btn-secondary" style="padding: 12px; font-size: 1rem; background: #ccc; border: none; border-radius: 6px; cursor: pointer;">
                        Ya avisamos
                    </button>
                </div>
            </div>
        </div>
    `;

    let modalContainer = document.getElementById('modal-container');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'modal-container';
        document.body.appendChild(modalContainer);
    }
    
    modalContainer.innerHTML = modalHtml;
    modalContainer.style.display = 'flex';

    document.getElementById('btn-wa-send').addEventListener('click', () => {
        openWhatsApp(wash.clienteTelefono || '', defaultMsg);
        closeModal();
    });

    document.getElementById('btn-wa-skip').addEventListener('click', () => {
        closeModal();
    });
}

export function showConfirmModal(mensaje, onConfirm, onCancel) {
    const modalHtml = `
        <div class="modal-backdrop" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
            <div class="modal-content" style="background: white; padding: 20px; border-radius: 8px; width: 90%; max-width: 400px; text-align: center;">
                <p class="modal-msg" style="font-size: 1.1rem; margin-bottom: 20px;">${mensaje}</p>
                <div class="modal-actions" style="display: flex; gap: 10px; justify-content: center;">
                    <button id="modal-btn-cancel" class="btn btn-secondary" style="padding: 10px 20px; cursor: pointer;">Cancelar</button>
                    <button id="modal-btn-confirm" class="btn btn-primary" style="padding: 10px 20px; background: #c9a227; color: white; border: none; cursor: pointer;">Confirmar</button>
                </div>
            </div>
        </div>
    `;

    let modalContainer = document.getElementById('modal-container');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'modal-container';
        document.body.appendChild(modalContainer);
    }
    
    modalContainer.innerHTML = modalHtml;
    modalContainer.style.display = 'flex';

    document.getElementById('modal-btn-cancel').addEventListener('click', () => {
        closeModal();
        if (onCancel) onCancel();
    });

    document.getElementById('modal-btn-confirm').addEventListener('click', () => {
        closeModal();
        if (onConfirm) onConfirm();
    });
}

function closeModal() {
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        modalContainer.style.display = 'none';
        modalContainer.innerHTML = '';
    }
}

function updateTimers() {
    const timers = document.querySelectorAll('.timer');
    timers.forEach(timerEl => {
        const state = timerEl.getAttribute('data-state');
        if (state === 'listo') {
            timerEl.textContent = '--:--:--';
            return;
        }

        const startTimestamp = timerEl.getAttribute('data-start');
        if (!startTimestamp) return;
        
        const startTime = new Date(startTimestamp).getTime();
        const now = Date.now();
        const diff = Math.max(0, now - startTime);

        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        const formatted = 
            String(hours).padStart(2, '0') + ':' +
            String(minutes).padStart(2, '0') + ':' +
            String(seconds).padStart(2, '0');
        
        timerEl.textContent = formatted;
    });
}
