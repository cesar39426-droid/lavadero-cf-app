import { db } from '../db/db.js';
import { auth } from '../auth.js';
import { toast } from '../utils/toast.js';
import { daysSince, formatRelativeDate, formatDate } from '../utils/format.js';
import { whatsappRecordatorio, openWhatsApp } from '../utils/whatsapp.js';

export async function render(container) {
    container.innerHTML = `
        <div class="module-header">
            <h2>Recordatorios de Mantenimiento <span id="recordatorios-badge" class="badge">0</span></h2>
            <div class="header-actions">
                <select id="filtro-dias" class="form-select">
                    <option value="todos">Todos (>25 días)</option>
                    <option value="criticos">Solo Críticos (30+ días)</option>
                </select>
            </div>
        </div>
        
        <div id="recordatorios-list" class="items-list">
            <div class="loading-state">Cargando recordatorios...</div>
        </div>

        <!-- Modal rápido para agendar -->
        <dialog id="modal-agendar-rapido" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Agendar Turno Rápido</h3>
                    <button class="btn-close" id="btn-cerrar-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-agendar-rapido">
                        <input type="hidden" id="agendar-cliente-id">
                        <div class="form-group">
                            <label>Cliente</label>
                            <input type="text" id="agendar-cliente-nombre" class="form-control" readonly>
                        </div>
                        <div class="form-group">
                            <label>Servicio Sugerido</label>
                            <input type="text" id="agendar-servicio" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>Fecha</label>
                            <input type="date" id="agendar-fecha" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Hora</label>
                            <input type="time" id="agendar-hora" class="form-control" required>
                        </div>
                        <div class="form-actions mt-3">
                            <button type="submit" class="btn btn-primary w-100">Agendar Turno</button>
                        </div>
                    </form>
                </div>
            </div>
        </dialog>
    `;
}

export async function init() {
    if (!auth.isAuthenticated()) return;

    const listContainer = document.getElementById('recordatorios-list');
    const filtroSelect = document.getElementById('filtro-dias');
    const badge = document.getElementById('recordatorios-badge');
    const modal = document.getElementById('modal-agendar-rapido');
    const formAgendar = document.getElementById('form-agendar-rapido');
    const btnCerrarModal = document.getElementById('btn-cerrar-modal');
    
    let recordatoriosData = [];

    async function loadRecordatorios() {
        try {
            // 1. Obtener todos los clientes
            const clientes = await db.getAll('clientes') || [];
            // 2. Obtener todos los lavados
            const lavados = await db.getAll('lavados') || [];
            
            recordatoriosData = [];

            for (const cliente of clientes) {
                // Obtener lavados completados del cliente
                const lavadosCliente = lavados.filter(l => l.clienteId === cliente.id && l.estado === 'completado');
                
                if (lavadosCliente.length > 0) {
                    // Ordenar por fecha descendente
                    lavadosCliente.sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));
                    const ultimoLavado = lavadosCliente[0];
                    
                    const dias = daysSince(ultimoLavado.fechaInicio);
                    
                    // Filtrar los que tienen > 25 días
                    if (dias >= 25) {
                        recordatoriosData.push({
                            cliente,
                            ultimoLavado,
                            dias
                        });
                    }
                }
            }
            
            // Ordenar de más urgente (más días) a menos
            recordatoriosData.sort((a, b) => b.dias - a.dias);
            
            renderList();
        } catch (error) {
            console.error('Error cargando recordatorios:', error);
            listContainer.innerHTML = '<div class="error-state">Error al cargar recordatorios</div>';
            toast.error('Error al cargar datos');
        }
    }

    function renderList() {
        const filtro = filtroSelect.value;
        const filtrados = recordatoriosData.filter(r => {
            if (filtro === 'criticos') return r.dias >= 30;
            return true; // todos los > 25
        });

        badge.textContent = filtrados.length;

        if (filtrados.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">✨</span>
                    <p>¡Todos los clientes tienen su mantenimiento al día!</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = filtrados.map(r => {
            const isCritico = r.dias >= 30;
            const colorClass = isCritico ? 'text-danger' : 'text-warning';
            const estadoTexto = isCritico ? 'Urgente' : 'Atención';
            
            return `
                <div class="list-item card mb-3 p-3">
                    <div class="item-content d-flex justify-content-between align-items-start mb-2">
                        <div class="item-header">
                            <h3 class="cliente-nombre m-0">${r.cliente.nombre}</h3>
                            <span class="badge ${isCritico ? 'bg-danger' : 'bg-warning'} mt-1">${estadoTexto}</span>
                        </div>
                        <div class="${colorClass} font-weight-bold">
                            Hace ${r.dias} días
                        </div>
                    </div>
                    <div class="item-details mb-3">
                        <p class="m-0 text-sm"><strong>Teléfono:</strong> ${r.cliente.telefono || 'No registrado'}</p>
                        <p class="m-0 text-sm"><strong>Último lavado:</strong> ${formatDate(r.ultimoLavado.fechaInicio)}</p>
                        <p class="m-0 text-sm"><strong>Servicio:</strong> ${r.ultimoLavado.servicio || 'General'}</p>
                    </div>
                    <div class="item-actions d-flex gap-2">
                        ${r.cliente.telefono ? 
                            `<button class="btn btn-outline-success btn-whatsapp flex-grow-1" data-id="${r.cliente.id}">
                                Enviar WhatsApp
                            </button>` : ''}
                        <button class="btn btn-outline-primary btn-agendar flex-grow-1" data-id="${r.cliente.id}">
                            Agendar Turno
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Event listeners para botones
        listContainer.querySelectorAll('.btn-whatsapp').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.target.dataset.id);
                const rec = recordatoriosData.find(r => r.cliente.id === id);
                if (rec && rec.cliente.telefono) {
                    const mensaje = whatsappRecordatorio(rec.cliente.nombre, rec.dias);
                    openWhatsApp(rec.cliente.telefono, mensaje);
                }
            });
        });

        listContainer.querySelectorAll('.btn-agendar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.target.dataset.id);
                const rec = recordatoriosData.find(r => r.cliente.id === id);
                if (rec) {
                    abrirModalAgendar(rec);
                }
            });
        });
    }

    function abrirModalAgendar(recordatorio) {
        document.getElementById('agendar-cliente-id').value = recordatorio.cliente.id;
        document.getElementById('agendar-cliente-nombre').value = recordatorio.cliente.nombre;
        document.getElementById('agendar-servicio').value = recordatorio.ultimoLavado.servicio || '';
        
        // Sugerir fecha hoy
        const hoy = new Date();
        document.getElementById('agendar-fecha').value = hoy.toISOString().split('T')[0];
        
        modal.showModal();
    }

    filtroSelect.addEventListener('change', renderList);
    
    btnCerrarModal.addEventListener('click', () => {
        modal.close();
        formAgendar.reset();
    });

    formAgendar.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const clienteId = Number(document.getElementById('agendar-cliente-id').value);
            const servicio = document.getElementById('agendar-servicio').value;
            const fecha = document.getElementById('agendar-fecha').value;
            const hora = document.getElementById('agendar-hora').value;
            
            const fechaInicio = new Date(`${fecha}T${hora}`).toISOString();

            const nuevoTurno = {
                clienteId,
                servicio,
                fechaInicio,
                estado: 'pendiente',
                createdAt: new Date().toISOString()
            };

            await db.add('lavados', nuevoTurno);
            toast.success('Turno agendado correctamente');
            modal.close();
            formAgendar.reset();
            
            // Recargar datos
            loadRecordatorios();
        } catch (error) {
            console.error('Error al agendar:', error);
            toast.error('No se pudo agendar el turno');
        }
    });

    await loadRecordatorios();
}
