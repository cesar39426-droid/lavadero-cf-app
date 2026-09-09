import { db } from '../db/db.js';
import { toast } from '../app.js';
import { formatMoney, formatDate } from '../utils/format.js';

let currentPeriod = 'month'; // 'day', 'week', 'month'
let currentTypeFilter = 'todos';
let costosData = [];
let serviciosActivos = [];

export async function render(container) {
    container.innerHTML = `
        <div class="module-header">
            <h2>Costos</h2>
            <button id="btn-add-costo" class="btn btn-primary">+ Agregar costo</button>
        </div>
        
        <div class="filters-container">
            <div class="filter-group">
                <label for="period-filter">Período:</label>
                <select id="period-filter">
                    <option value="day">Hoy</option>
                    <option value="week">Esta semana</option>
                    <option value="month" selected>Este mes</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="type-filter">Tipo:</label>
                <select id="type-filter">
                    <option value="todos">Todos</option>
                    <option value="insumo">Insumo</option>
                    <option value="sueldo">Sueldo</option>
                    <option value="servicio">Servicio</option>
                    <option value="mantenimiento">Mantenimiento</option>
                </select>
            </div>
        </div>
        
        <div class="totals-container" id="totals-container">
            <!-- Totales dinámicos -->
        </div>

        <div class="costos-list" id="costos-list">
            <!-- Lista de costos -->
        </div>

        <!-- Modal Costo -->
        <div id="costo-modal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h3 id="modal-title">Agregar Costo</h3>
                <form id="costo-form">
                    <input type="hidden" id="costo-id">
                    
                    <div class="form-group">
                        <label for="costo-descripcion">Descripción *</label>
                        <input type="text" id="costo-descripcion" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="costo-monto">Monto *</label>
                        <input type="number" id="costo-monto" min="0" step="0.01" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="costo-tipo">Tipo *</label>
                        <select id="costo-tipo" required>
                            <option value="insumo">Insumo</option>
                            <option value="sueldo">Sueldo</option>
                            <option value="servicio">Servicio</option>
                            <option value="mantenimiento">Mantenimiento</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="costo-fecha">Fecha *</label>
                        <input type="date" id="costo-fecha" required>
                    </div>
                    
                    <div class="form-group checkbox-group">
                        <input type="checkbox" id="costo-recurrente">
                        <label for="costo-recurrente">¿Es recurrente?</label>
                    </div>
                    
                    <div class="form-group">
                        <label for="costo-servicio">Servicio Asociado (Opcional)</label>
                        <select id="costo-servicio">
                            <option value="">Ninguno</option>
                            <!-- Opciones dinámicas -->
                        </select>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">Guardar</button>
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
        costosData = await db.getAll('costos') || [];
        serviciosActivos = await db.getAll('servicios') || [];
        serviciosActivos = serviciosActivos.filter(s => s.activo !== false);
    } catch (error) {
        console.error("Error loading costos data:", error);
        toast("Error al cargar datos", "error");
    }
}

function setupEventListeners() {
    document.getElementById('btn-add-costo').addEventListener('click', () => openModal());
    document.getElementById('period-filter').addEventListener('change', (e) => {
        currentPeriod = e.target.value;
        updateUI();
    });
    document.getElementById('type-filter').addEventListener('change', (e) => {
        currentTypeFilter = e.target.value;
        updateUI();
    });
    
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target.id === 'costo-modal') closeModal();
    });
    
    document.getElementById('costo-form').addEventListener('submit', handleSaveCosto);
}

function filterCostos() {
    const now = new Date();
    let startDate = new Date();
    
    if (currentPeriod === 'day') {
        startDate.setHours(0, 0, 0, 0);
    } else if (currentPeriod === 'week') {
        const day = startDate.getDay() || 7; 
        startDate.setDate(startDate.getDate() - day + 1);
        startDate.setHours(0, 0, 0, 0);
    } else if (currentPeriod === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return costosData.filter(costo => {
        const costoDate = new Date(costo.fecha + "T12:00:00");
        const matchesPeriod = costoDate >= startDate && costoDate <= now;
        const matchesType = currentTypeFilter === 'todos' || costo.tipo === currentTypeFilter;
        return matchesPeriod && matchesType;
    });
}

function updateUI() {
    const filteredCostos = filterCostos();
    renderCostosList(filteredCostos);
    renderTotals(filteredCostos);
}

function renderCostosList(costos) {
    const list = document.getElementById('costos-list');
    if (costos.length === 0) {
        list.innerHTML = '<p class="empty-state">No hay costos en el período seleccionado.</p>';
        return;
    }
    
    list.innerHTML = costos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(costo => `
        <div class="card costo-card">
            <div class="costo-info">
                <h4>${costo.descripcion}</h4>
                <p class="meta">
                    <span class="badge badge-${costo.tipo}">${costo.tipo}</span> 
                    | ${formatDate(costo.fecha)} 
                    ${costo.recurrente ? '| 🔄 Recurrente' : ''}
                </p>
                <p class="monto">${formatMoney(costo.monto)}</p>
            </div>
            <div class="actions">
                <button class="btn btn-secondary btn-edit" data-id="${costo.id}">Editar</button>
                <button class="btn btn-danger btn-delete" data-id="${costo.id}">Eliminar</button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.btn-edit').forEach(btn => 
        btn.addEventListener('click', (e) => editCosto(Number(e.target.dataset.id)))
    );
    document.querySelectorAll('.btn-delete').forEach(btn => 
        btn.addEventListener('click', (e) => deleteCosto(Number(e.target.dataset.id)))
    );
}

function renderTotals(costos) {
    const totalsContainer = document.getElementById('totals-container');
    const totalGral = costos.reduce((sum, c) => sum + Number(c.monto), 0);
    
    const byType = costos.reduce((acc, c) => {
        acc[c.tipo] = (acc[c.tipo] || 0) + Number(c.monto);
        return acc;
    }, {});
    
    let html = `<div class="total-general"><strong>Total:</strong> ${formatMoney(totalGral)}</div>`;
    
    if (currentTypeFilter === 'todos') {
        html += `<div class="totales-desglose">`;
        for (const [tipo, monto] of Object.entries(byType)) {
            html += `<span>${tipo}: ${formatMoney(monto)}</span>`;
        }
        html += `</div>`;
    }
    
    totalsContainer.innerHTML = html;
}

function openModal(costo = null) {
    const modal = document.getElementById('costo-modal');
    const form = document.getElementById('costo-form');
    const title = document.getElementById('modal-title');
    const servicioSelect = document.getElementById('costo-servicio');
    
    servicioSelect.innerHTML = '<option value="">Ninguno</option>' + 
        serviciosActivos.map(s => `<option value="${s.id}">${s.nombre}</option>`).join('');
    
    if (costo) {
        title.textContent = 'Editar Costo';
        document.getElementById('costo-id').value = costo.id;
        document.getElementById('costo-descripcion').value = costo.descripcion;
        document.getElementById('costo-monto').value = costo.monto;
        document.getElementById('costo-tipo').value = costo.tipo;
        document.getElementById('costo-fecha').value = costo.fecha;
        document.getElementById('costo-recurrente').checked = costo.recurrente || false;
        document.getElementById('costo-servicio').value = costo.servicioId || '';
    } else {
        title.textContent = 'Agregar Costo';
        form.reset();
        document.getElementById('costo-id').value = '';
        const today = new Date();
        document.getElementById('costo-fecha').value = today.toISOString().split('T')[0];
    }
    
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('costo-modal').style.display = 'none';
}

async function handleSaveCosto(e) {
    e.preventDefault();
    
    const id = document.getElementById('costo-id').value;
    const costo = {
        descripcion: document.getElementById('costo-descripcion').value,
        monto: Number(document.getElementById('costo-monto').value),
        tipo: document.getElementById('costo-tipo').value,
        fecha: document.getElementById('costo-fecha').value,
        recurrente: document.getElementById('costo-recurrente').checked,
        servicioId: document.getElementById('costo-servicio').value ? Number(document.getElementById('costo-servicio').value) : null
    };
    
    try {
        if (id) {
            costo.id = Number(id);
            await db.update('costos', costo);
            toast('Costo actualizado');
        } else {
            await db.add('costos', costo);
            toast('Costo agregado');
        }
        
        closeModal();
        await loadData();
        updateUI();
    } catch (error) {
        console.error("Error guardando costo:", error);
        toast('Error al guardar costo', 'error');
    }
}

async function editCosto(id) {
    const costo = costosData.find(c => c.id === id);
    if (costo) openModal(costo);
}

async function deleteCosto(id) {
    if (confirm('¿Estás seguro de eliminar este costo?')) {
        try {
            await db.delete('costos', id);
            toast('Costo eliminado');
            await loadData();
            updateUI();
        } catch (error) {
            console.error("Error eliminando costo:", error);
            toast('Error al eliminar costo', 'error');
        }
    }
}
