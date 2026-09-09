import { db } from '../db/db.js';
import { auth } from '../auth.js';
import { toast } from '../app.js';
import { formatMoney, formatDate } from '../utils/format.js';

let empleadosData = [];
let lavadosData = [];
let currentFilter = 'activos'; // 'activos', 'inactivos', 'todos'

export async function render(container) {
    container.innerHTML = `
        <div class="module-header">
            <h2>Empleados</h2>
            <button id="btn-add-empleado" class="btn btn-primary">+ Agregar empleado</button>
        </div>
        
        <div class="filters-container">
            <div class="filter-group">
                <label for="status-filter">Estado:</label>
                <select id="status-filter">
                    <option value="activos" selected>Activos</option>
                    <option value="inactivos">Inactivos</option>
                    <option value="todos">Todos</option>
                </select>
            </div>
        </div>

        <div class="empleados-list" id="empleados-list">
            <!-- Lista de empleados -->
        </div>

        <!-- Modal Empleado -->
        <div id="empleado-modal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h3 id="modal-title">Agregar Empleado</h3>
                <form id="empleado-form">
                    <input type="hidden" id="empleado-id">
                    
                    <div class="form-group">
                        <label for="emp-nombre">Nombre *</label>
                        <input type="text" id="emp-nombre" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="emp-tipo">Tipo *</label>
                        <select id="emp-tipo" required>
                            <option value="permanente">Permanente</option>
                            <option value="temporal">Temporal</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="emp-pin">PIN (4 dígitos) *</label>
                        <input type="password" id="emp-pin" pattern="\\d{4}" title="Debe ser un número de 4 dígitos" required autocomplete="new-password">
                        <small id="pin-hint" style="display:none;">Dejá en blanco si no querés cambiarlo.</small>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </form>
            </div>
        </div>

        <!-- Modal Historial -->
        <div id="historial-modal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close-historial-modal">&times;</span>
                <h3 id="historial-title">Historial del Empleado</h3>
                <div id="historial-list"></div>
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
        empleadosData = await db.getAll('empleados') || [];
        lavadosData = await db.getAll('lavados') || [];
    } catch (error) {
        console.error("Error loading empleados data:", error);
        toast("Error al cargar datos", "error");
    }
}

function setupEventListeners() {
    document.getElementById('btn-add-empleado').addEventListener('click', () => openModal());
    document.getElementById('status-filter').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        updateUI();
    });
    
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.querySelector('.close-historial-modal').addEventListener('click', closeHistorialModal);
    
    window.addEventListener('click', (e) => {
        if (e.target.id === 'empleado-modal') closeModal();
        if (e.target.id === 'historial-modal') closeHistorialModal();
    });
    
    document.getElementById('empleado-form').addEventListener('submit', handleSaveEmpleado);
}

function filterEmpleados() {
    return empleadosData.filter(emp => {
        if (currentFilter === 'activos') return emp.activo !== false;
        if (currentFilter === 'inactivos') return emp.activo === false;
        return true;
    });
}

function getEmpleadoStats(empId) {
    const lavados = lavadosData.filter(l => l.empleadoId === empId && l.estado === 'completado');
    const comisiones = lavados.reduce((sum, l) => sum + (Number(l.comision) || 0), 0);
    return { count: lavados.length, comisiones };
}

function updateUI() {
    const filtered = filterEmpleados();
    const list = document.getElementById('empleados-list');
    
    if (filtered.length === 0) {
        list.innerHTML = '<p class="empty-state">No hay empleados para mostrar.</p>';
        return;
    }
    
    list.innerHTML = filtered.map(emp => {
        const stats = getEmpleadoStats(emp.id);
        const isActive = emp.activo !== false;
        const isDueno = emp.rol === 'dueno';
        
        return `
            <div class="card empleado-card ${!isActive ? 'inactivo' : ''}">
                <div class="emp-info">
                    <h4>${emp.nombre} ${isDueno ? '<span class="badge badge-primary">Dueño</span>' : ''}</h4>
                    <p class="meta">
                        ${emp.tipo || 'permanente'} | Estado: ${isActive ? 'Activo' : 'Inactivo'}
                    </p>
                    <p>Lavados históricos: ${stats.count}</p>
                    <p>Comisiones totales: ${formatMoney(stats.comisiones)}</p>
                </div>
                <div class="actions">
                    <button class="btn btn-secondary btn-historial" data-id="${emp.id}">Ver Historial</button>
                    <button class="btn btn-secondary btn-edit" data-id="${emp.id}">Editar</button>
                    ${!isDueno ? `
                        ${isActive ? 
                            `<button class="btn btn-danger btn-toggle-status" data-id="${emp.id}" data-action="deactivate">Desactivar</button>` : 
                            `<button class="btn btn-primary btn-toggle-status" data-id="${emp.id}" data-action="activate">Reactivar</button>`
                        }
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.btn-edit').forEach(btn => 
        btn.addEventListener('click', (e) => editEmpleado(Number(e.target.dataset.id)))
    );
    document.querySelectorAll('.btn-toggle-status').forEach(btn => 
        btn.addEventListener('click', (e) => toggleStatus(Number(e.target.dataset.id), e.target.dataset.action === 'activate'))
    );
    document.querySelectorAll('.btn-historial').forEach(btn => 
        btn.addEventListener('click', (e) => showHistorial(Number(e.target.dataset.id)))
    );
}

function openModal(empleado = null) {
    const modal = document.getElementById('empleado-modal');
    const form = document.getElementById('empleado-form');
    const title = document.getElementById('modal-title');
    const pinInput = document.getElementById('emp-pin');
    const pinHint = document.getElementById('pin-hint');
    
    form.reset();
    
    if (empleado) {
        title.textContent = 'Editar Empleado';
        document.getElementById('empleado-id').value = empleado.id;
        document.getElementById('emp-nombre').value = empleado.nombre;
        document.getElementById('emp-tipo').value = empleado.tipo || 'permanente';
        pinInput.removeAttribute('required');
        pinHint.style.display = 'block';
    } else {
        title.textContent = 'Agregar Empleado';
        document.getElementById('empleado-id').value = '';
        pinInput.setAttribute('required', 'required');
        pinHint.style.display = 'none';
    }
    
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('empleado-modal').style.display = 'none';
}

function closeHistorialModal() {
    document.getElementById('historial-modal').style.display = 'none';
}

async function handleSaveEmpleado(e) {
    e.preventDefault();
    
    const id = document.getElementById('empleado-id').value;
    const pin = document.getElementById('emp-pin').value;
    
    // Validar PIN único
    if (pin) {
        const pinExists = empleadosData.some(emp => emp.pin === pin && emp.id !== Number(id));
        if (pinExists) {
            toast('Ese PIN ya está en uso. Elegí otro.', 'error');
            return;
        }
    }
    
    const empleadoData = {
        nombre: document.getElementById('emp-nombre').value,
        tipo: document.getElementById('emp-tipo').value,
    };
    if (pin) {
        empleadoData.pin = pin;
    }
    
    try {
        if (id) {
            const emp = empleadosData.find(e => e.id === Number(id));
            await db.update('empleados', { ...emp, ...empleadoData });
            toast('Empleado actualizado');
        } else {
            empleadoData.activo = true;
            empleadoData.rol = 'empleado';
            await db.add('empleados', empleadoData);
            toast('Empleado agregado');
        }
        
        closeModal();
        await loadData();
        updateUI();
    } catch (error) {
        console.error("Error guardando empleado:", error);
        toast('Error al guardar empleado', 'error');
    }
}

async function editEmpleado(id) {
    const emp = empleadosData.find(e => e.id === id);
    if (emp) openModal(emp);
}

async function toggleStatus(id, activate) {
    const emp = empleadosData.find(e => e.id === id);
    if (!emp) return;
    
    if (emp.rol === 'dueno') {
        toast('El dueño no puede ser modificado', 'error');
        return;
    }
    
    const actionText = activate ? 'reactivar' : 'desactivar';
    if (confirm(`¿Estás seguro de ${actionText} a ${emp.nombre}?`)) {
        try {
            await db.update('empleados', { ...emp, activo: activate });
            toast(`Empleado ${activate ? 'reactivado' : 'desactivado'}`);
            await loadData();
            updateUI();
        } catch (error) {
            console.error(`Error al ${actionText} empleado:`, error);
            toast(`Error al ${actionText} empleado`, 'error');
        }
    }
}

function showHistorial(empId) {
    const emp = empleadosData.find(e => e.id === empId);
    if (!emp) return;
    
    const lavados = lavadosData.filter(l => l.empleadoId === empId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    const title = document.getElementById('historial-title');
    title.textContent = `Historial: ${emp.nombre}`;
    
    const list = document.getElementById('historial-list');
    if (lavados.length === 0) {
        list.innerHTML = '<p>No hay lavados registrados.</p>';
    } else {
        list.innerHTML = `
            <ul style="list-style:none; padding:0;">
                ${lavados.map(l => `
                    <li style="border-bottom:1px solid #ccc; padding:10px 0;">
                        <strong>${formatDate(l.fecha)}</strong> - ${l.patente} <br>
                        Estado: ${l.estado} | Comisión: ${formatMoney(l.comision || 0)}
                    </li>
                `).join('')}
            </ul>
        `;
    }
    
    document.getElementById('historial-modal').style.display = 'block';
}
