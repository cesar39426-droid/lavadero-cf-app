import { db } from '../db/db.js';
import { toast } from '../app.js';
import { formatMoney } from '../utils/format.js';

let serviciosData = [];
let lavadosData = [];

export async function render(container) {
    container.innerHTML = `
        <div class="module-header">
            <h2>Servicios</h2>
        </div>
        
        <p class="text-muted">Los servicios predeterminados solo pueden ser editados o desactivados.</p>

        <div class="servicios-list" id="servicios-list">
            <!-- Lista de servicios -->
        </div>

        <!-- Modal Servicio -->
        <div id="servicio-modal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h3 id="modal-title">Editar Servicio</h3>
                <form id="servicio-form">
                    <input type="hidden" id="servicio-id">
                    
                    <div class="form-group">
                        <label for="srv-nombre">Nombre *</label>
                        <input type="text" id="srv-nombre" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="srv-descripcion">Descripción</label>
                        <textarea id="srv-descripcion" rows="3"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="srv-precio">Precio ($) *</label>
                        <input type="number" id="srv-precio" min="0" step="0.01" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="srv-comision">Comisión (%) *</label>
                        <input type="number" id="srv-comision" min="0" max="100" step="1" required>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                </form>
            </div>
        </div>
    `;
}

export async function init() {
    await loadData();
    setupEventListeners();
    updateUI();
}

async function loadData() {
    try {
        serviciosData = await db.getAll('servicios') || [];
        lavadosData = await db.getAll('lavados') || [];
    } catch (error) {
        console.error("Error loading servicios data:", error);
        toast("Error al cargar datos", "error");
    }
}

function setupEventListeners() {
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    
    window.addEventListener('click', (e) => {
        if (e.target.id === 'servicio-modal') closeModal();
    });
    
    document.getElementById('servicio-form').addEventListener('submit', handleSaveServicio);
}

function updateUI() {
    const list = document.getElementById('servicios-list');
    
    if (serviciosData.length === 0) {
        list.innerHTML = '<p class="empty-state">No hay servicios.</p>';
        return;
    }
    
    list.innerHTML = serviciosData.map(srv => {
        const isActive = srv.activo !== false;
        
        return `
            <div class="card servicio-card ${!isActive ? 'inactivo' : ''}">
                <div class="srv-info">
                    <h4>${srv.nombre} ${!isActive ? '<span class="badge">Inactivo</span>' : ''}</h4>
                    <p>${srv.descripcion || 'Sin descripción'}</p>
                    <div class="srv-meta">
                        <span class="precio">${formatMoney(srv.precio)}</span>
                        <span class="comision">Comisión: ${srv.porcentajeComision}%</span>
                    </div>
                </div>
                <div class="actions">
                    <button class="btn btn-secondary btn-edit" data-id="${srv.id}">Editar</button>
                    ${isActive ? 
                        `<button class="btn btn-danger btn-toggle" data-id="${srv.id}" data-action="deactivate">Desactivar</button>` : 
                        `<button class="btn btn-primary btn-toggle" data-id="${srv.id}" data-action="activate">Activar</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.btn-edit').forEach(btn => 
        btn.addEventListener('click', (e) => editServicio(Number(e.target.dataset.id)))
    );
    document.querySelectorAll('.btn-toggle').forEach(btn => 
        btn.addEventListener('click', (e) => toggleStatus(Number(e.target.dataset.id), e.target.dataset.action === 'activate'))
    );
}

function openModal(servicio) {
    const modal = document.getElementById('servicio-modal');
    
    document.getElementById('servicio-id').value = servicio.id;
    document.getElementById('srv-nombre').value = servicio.nombre;
    document.getElementById('srv-descripcion').value = servicio.descripcion || '';
    document.getElementById('srv-precio').value = servicio.precio;
    document.getElementById('srv-comision').value = servicio.porcentajeComision;
    
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('servicio-modal').style.display = 'none';
}

async function handleSaveServicio(e) {
    e.preventDefault();
    
    const id = Number(document.getElementById('servicio-id').value);
    const srv = serviciosData.find(s => s.id === id);
    if (!srv) return;
    
    const newData = {
        nombre: document.getElementById('srv-nombre').value,
        descripcion: document.getElementById('srv-descripcion').value,
        precio: Number(document.getElementById('srv-precio').value),
        porcentajeComision: Number(document.getElementById('srv-comision').value)
    };
    
    // Check if price/commission changed and warn if washes in progress
    if (newData.precio !== srv.precio || newData.porcentajeComision !== srv.porcentajeComision) {
        const lavadosEnProgreso = lavadosData.filter(l => l.servicioId === id && l.estado === 'en_progreso');
        if (lavadosEnProgreso.length > 0) {
            const ok = confirm(`Hay ${lavadosEnProgreso.length} lavado(s) en progreso usando este servicio. ¿Guardar de todos modos?`);
            if (!ok) return;
        }
    }
    
    try {
        await db.update('servicios', { ...srv, ...newData });
        toast('Servicio actualizado');
        closeModal();
        await loadData();
        updateUI();
    } catch (error) {
        console.error("Error guardando servicio:", error);
        toast('Error al guardar servicio', 'error');
    }
}

function editServicio(id) {
    const srv = serviciosData.find(s => s.id === id);
    if (srv) openModal(srv);
}

async function toggleStatus(id, activate) {
    const srv = serviciosData.find(s => s.id === id);
    if (!srv) return;
    
    if (!activate) {
        const lavadosEnProgreso = lavadosData.filter(l => l.servicioId === id && l.estado === 'en_progreso');
        if (lavadosEnProgreso.length > 0) {
            toast('No se puede desactivar: hay lavados en progreso usando este servicio.', 'error');
            return;
        }
    }
    
    if (confirm(`¿Estás seguro de ${activate ? 'activar' : 'desactivar'} este servicio?`)) {
        try {
            await db.update('servicios', { ...srv, activo: activate });
            toast(`Servicio ${activate ? 'activado' : 'desactivado'}`);
            await loadData();
            updateUI();
        } catch (error) {
            console.error(`Error al ${activate ? 'activar' : 'desactivar'} servicio:`, error);
            toast('Error al cambiar estado', 'error');
        }
    }
}
