import { db } from '../db/db.js';
import { auth } from '../auth.js';
import { formatMoney, formatDate, formatDateShort } from '../utils/format.js';
import { cierreDeCajaToCSV, exportToCSV } from '../utils/csv.js';

let currentDate = new Date().toISOString().split('T')[0];
let currentData = {
    lavados: [],
    costos: []
};

export async function render(container) {
    container.innerHTML = `
        <div class="cierre-caja-header">
            <h2>Cierre de Caja</h2>
            <div class="cierre-controls">
                <input type="date" id="cierre-date" value="${currentDate}">
                <button id="btn-export-csv" class="btn btn-secondary">Exportar CSV</button>
            </div>
        </div>
        
        <div class="cierre-content" id="cierre-content">
            <p class="loading">Cargando datos...</p>
        </div>
    `;
}

export async function init() {
    const dateInput = document.getElementById('cierre-date');
    const exportBtn = document.getElementById('btn-export-csv');
    
    dateInput.addEventListener('change', async (e) => {
        currentDate = e.target.value;
        await loadData();
        renderContent();
    });
    
    exportBtn.addEventListener('click', () => {
        if (currentData.lavados.length === 0 && currentData.costos.length === 0) {
            alert('No hay datos para exportar en esta fecha.');
            return;
        }
        
        try {
            const csvContent = cierreDeCajaToCSV(currentDate, currentData.lavados, currentData.costos);
            exportToCSV(csvContent, `cierre-caja-${currentDate}.csv`);
        } catch (error) {
            console.error('Error al exportar CSV', error);
            alert('Hubo un error al generar el CSV.');
        }
    });

    await loadData();
    renderContent();
}

async function loadData() {
    try {
        const todosLosLavados = await db.getAll('lavados');
        
        currentData.lavados = todosLosLavados.filter(lavado => {
            if (lavado.estado !== 'listo') return false;
            const fechaLavado = (lavado.fecha || lavado.createdAt || '').split('T')[0];
            return fechaLavado === currentDate;
        });

        const todosLosCostos = await db.getAll('costos') || [];
        
        currentData.costos = todosLosCostos.filter(costo => {
            const fechaCosto = (costo.fecha || costo.createdAt || '').split('T')[0];
            return fechaCosto === currentDate;
        });
        
    } catch (error) {
        console.error("Error al cargar datos del cierre de caja", error);
        currentData = { lavados: [], costos: [] };
    }
}

function renderContent() {
    const content = document.getElementById('cierre-content');
    
    if (!content) return;
    
    if (currentData.lavados.length === 0) {
        content.innerHTML = `<div class="empty-state">No hay lavados finalizados para esta fecha.</div>`;
        return;
    }

    let ingresoBruto = 0;
    let totalComisiones = 0;
    let totalCostos = 0;
    const comisionesPorEmpleado = {};

    currentData.lavados.forEach(lav => {
        const precio = Number(lav.precio) || 0;
        const comision = Number(lav.comision) || 0;
        
        ingresoBruto += precio;
        totalComisiones += comision;
        
        const emp = lav.empleado || 'Sin Asignar';
        if (!comisionesPorEmpleado[emp]) {
            comisionesPorEmpleado[emp] = 0;
        }
        comisionesPorEmpleado[emp] += comision;
    });
    
    currentData.costos.forEach(costo => {
        totalCostos += Number(costo.monto) || 0;
    });

    const gananciaNeta = ingresoBruto - totalComisiones - totalCostos;

    let html = '';

    html += `
        <div class="cierre-section">
            <h3>Lavados del Día</h3>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Vehículo</th>
                            <th>Servicio</th>
                            <th>Empleado</th>
                            <th>Precio</th>
                            <th>Comisión</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${currentData.lavados.map(lav => `
                            <tr>
                                <td>${escapeHtml(lav.cliente)}</td>
                                <td>${escapeHtml(lav.vehiculo)}</td>
                                <td>${escapeHtml(lav.servicio)}</td>
                                <td>${escapeHtml(lav.empleado)}</td>
                                <td>${formatMoney(lav.precio)}</td>
                                <td>${formatMoney(lav.comision)}</td>
                                <td><span class="chip chip-listo">${escapeHtml(lav.estado)}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    const empleados = Object.keys(comisionesPorEmpleado);
    if (empleados.length > 0) {
        html += `
            <div class="cierre-section comisiones-section">
                <h3>Desglose de Comisiones por Empleado</h3>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Empleado</th>
                                <th>Total a cobrar</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${empleados.map(emp => `
                                <tr>
                                    <td>${escapeHtml(emp)}</td>
                                    <td>${formatMoney(comisionesPorEmpleado[emp])}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    if (currentData.costos.length > 0) {
        html += `
            <div class="cierre-section costos-section">
                <h3>Costos del Día</h3>
                <ul>
                    ${currentData.costos.map(c => `<li>${escapeHtml(c.descripcion || c.nombre)}: ${formatMoney(c.monto)}</li>`).join('')}
                </ul>
                <p><strong>Total Costos: ${formatMoney(totalCostos)}</strong></p>
            </div>
        `;
    }

    html += `
        <div class="cierre-summary-card">
            <h3>Resumen Financiero</h3>
            <div class="summary-details" style="border: 2px solid var(--color-dorado, #c9a227); padding: 20px; border-radius: 8px;">
                <div class="summary-row">
                    <span>Ingreso bruto:</span>
                    <span>${formatMoney(ingresoBruto)}</span>
                </div>
                <div class="summary-row">
                    <span>Costos:</span>
                    <span class="text-danger">-${formatMoney(totalCostos)}</span>
                </div>
                <div class="summary-row">
                    <span>Comisiones:</span>
                    <span class="text-danger">-${formatMoney(totalComisiones)}</span>
                </div>
                <div class="summary-row total-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333;">
                    <span style="font-size: 1.2rem; font-weight: bold;">Ganancia neta:</span>
                    <span class="text-gold" style="font-size: 1.5rem; font-weight: bold; color: var(--color-dorado, #c9a227);">${formatMoney(gananciaNeta)}</span>
                </div>
            </div>
        </div>
    `;

    content.innerHTML = html;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
