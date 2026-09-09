import { db } from '../db/db.js';
import { auth } from '../auth.js';
import { toast } from '../utils/toast.js';
import { formatDate, formatRelativeDate, daysSince } from '../utils/format.js';
import { importClientesFromCSV } from '../utils/csv.js';
import { whatsappRecordatorio, openWhatsApp } from '../utils/whatsapp.js';

let container = null;
let debounceTimer;

export async function render(targetContainer) {
    container = targetContainer;
    await renderMainView();
}

export async function init() {
    // Initial setup if needed (listeners are usually attached in render)
}

// -----------------------------------------------------------------------------
// VISTA PRINCIPAL: LISTA DE CLIENTES
// -----------------------------------------------------------------------------
async function renderMainView() {
    container.innerHTML = `
        <div class="header-actions">
            <h1>Clientes</h1>
            <div>
                <button class="btn btn-secondary" id="btn-import-csv">Importar CSV</button>
                <button class="btn btn-primary" id="btn-nuevo-cliente">+ Nuevo cliente</button>
            </div>
        </div>
        <div class="search-container">
            <input type="text" class="input search-input" id="search-clientes" placeholder="Buscar por nombre, teléfono o patente..." autocomplete="off">
        </div>
        <div id="clientes-list" class="list-container">
            ${getSkeletonHTML(3)}
        </div>
    `;

    document.getElementById('btn-nuevo-cliente').addEventListener('click', () => renderModalNuevoEditar());
    document.getElementById('btn-import-csv').addEventListener('click', () => renderModalImportCSV());
    
    const searchInput = document.getElementById('search-clientes');
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            loadClientesList(e.target.value.trim());
        }, 300);
    });

    await loadClientesList('');
}

function getSkeletonHTML(count) {
    return Array(count).fill(`
        <div class="card skeleton">
            <div style="height: 20px; width: 60%; margin-bottom: 10px; background: #eee; border-radius: 4px;"></div>
            <div style="height: 16px; width: 40%; margin-bottom: 10px; background: #eee; border-radius: 4px;"></div>
            <div style="height: 16px; width: 80%; background: #eee; border-radius: 4px;"></div>
        </div>
    `).join('');
}

async function loadClientesList(searchTerm) {
    const listContainer = document.getElementById('clientes-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = getSkeletonHTML(3);
    
    try {
        let clientes = await db.getAll('clientes');
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            clientes = clientes.filter(c => 
                (c.nombre && c.nombre.toLowerCase().includes(term)) ||
                (c.telefono && c.telefono.includes(term)) ||
                (c.patentes && c.patentes.some(p => p.toLowerCase().includes(term)))
            );
        }
        
        // Ordenar alfabéticamente
        clientes.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

        if (clientes.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 3rem; color: var(--gold, #c9a227); margin-bottom: 1rem;">👥</div>
                    <p>${searchTerm ? 'No se encontraron clientes con esa búsqueda.' : 'Aún no hay clientes registrados. ¡Registrá el primero!'}</p>
                </div>
            `;
            return;
        }

        let html = '';
        for (const cliente of clientes) {
            // Get last wash
            const lavados = await db.getAll('lavados'); // Idealmente habría un index por clienteId
            const clienteLavados = lavados.filter(l => l.clienteId === cliente.id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            const lastLavado = clienteLavados.length > 0 ? clienteLavados[0] : null;
            const totalLavados = clienteLavados.length;
            
            let recordatorioBadge = '';
            if (lastLavado) {
                const days = daysSince(lastLavado.fecha);
                if (days >= 30) {
                    recordatorioBadge = `<span class="badge gold" style="background: var(--gold, #c9a227); color: #fff;">¡Recordatorio Pendiente! (${days} días)</span>`;
                }
            }

            html += `
                <div class="card list-item cliente-card" data-id="${cliente.id}" style="cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h3 style="margin: 0 0 0.5rem 0;">${cliente.nombre} ${recordatorioBadge}</h3>
                            <p style="margin: 0; color: #555;">📞 ${cliente.telefono}</p>
                            <div style="margin-top: 0.5rem;">
                                ${(cliente.patentes || []).map(p => `<span class="chip" style="background: #e0e0e0; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-right: 4px;">${p}</span>`).join('')}
                            </div>
                        </div>
                        <div style="text-align: right; font-size: 0.9rem; color: #666;">
                            <div>Último: ${lastLavado ? formatRelativeDate(lastLavado.fecha) : 'Nunca'}</div>
                            <div>Total: ${totalLavados} lavados</div>
                        </div>
                    </div>
                </div>
            `;
        }

        listContainer.innerHTML = html;

        // Add click events to cards
        listContainer.querySelectorAll('.cliente-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.getAttribute('data-id'), 10);
                renderDetailView(id);
            });
        });

    } catch (error) {
        console.error("Error loading clientes:", error);
        toast('Error al cargar la lista de clientes', 'error');
        listContainer.innerHTML = `<div class="empty-state">Ocurrió un error al cargar los clientes.</div>`;
    }
}


// -----------------------------------------------------------------------------
// VISTA DETALLE: HISTORIAL DE CLIENTE
// -----------------------------------------------------------------------------
async function renderDetailView(clienteId) {
    container.innerHTML = `
        <div style="padding: 1rem;">
            <div>Cargando detalle del cliente...</div>
        </div>
    `;

    try {
        const cliente = await db.get('clientes', clienteId);
        if (!cliente) {
            toast('Cliente no encontrado', 'error');
            await renderMainView();
            return;
        }

        const lavados = await db.getAll('lavados');
        const clienteLavados = lavados.filter(l => l.clienteId === cliente.id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        const totalLavados = clienteLavados.length;
        
        let recordatorioBtn = '';
        if (clienteLavados.length > 0) {
            const days = daysSince(clienteLavados[0].fecha);
            if (days >= 30) {
                recordatorioBtn = `<button class="btn btn-secondary" id="btn-wpp-recordatorio" style="border-color: #25D366; color: #25D366;">📱 Enviar Recordatorio (30+ días)</button>`;
            }
        }

        let lavadosHtml = '';
        if (clienteLavados.length === 0) {
            lavadosHtml = `<p style="color: #666; font-style: italic;">No hay historial de lavados para este cliente.</p>`;
        } else {
            lavadosHtml = clienteLavados.map(l => `
                <div class="list-item" style="border-bottom: 1px solid #eee; padding: 0.5rem 0; display: flex; justify-content: space-between;">
                    <div>
                        <strong>${formatDate(l.fecha)}</strong> - ${l.servicio}
                        <br><small style="color: #666;">Atendido por: ${l.empleadoNombre || 'N/A'}</small>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge ${l.estado === 'completado' ? 'success' : 'warning'}">${l.estado}</span>
                        <br><strong>$${l.precio}</strong>
                    </div>
                </div>
            `).join('');
        }

        container.innerHTML = `
            <div class="header-actions" style="margin-bottom: 1rem;">
                <button class="btn btn-secondary" id="btn-volver-lista">← Volver</button>
                <div>
                    <button class="btn btn-secondary" id="btn-editar-cliente">Editar</button>
                    <button class="btn btn-primary" id="btn-nuevo-lavado">+ Nuevo Lavado</button>
                </div>
            </div>
            
            <div class="card" style="margin-bottom: 2rem;">
                <h2 style="font-family: 'Playfair Display', serif; font-size: 2rem; margin: 0 0 1rem 0;">${cliente.nombre}</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <p><strong>Teléfono:</strong> <a href="tel:${cliente.telefono}">${cliente.telefono}</a> <button id="btn-wpp-direct" style="background:none;border:none;cursor:pointer;" title="Abrir WhatsApp">💬</button></p>
                        <p><strong>Email:</strong> ${cliente.email || '-'}</p>
                        <p><strong>Patentes:</strong> ${cliente.patentes ? cliente.patentes.join(', ') : '-'}</p>
                    </div>
                    <div>
                        <p><strong>Fecha de alta:</strong> ${cliente.fechaAlta ? formatDate(cliente.fechaAlta) : '-'}</p>
                        <p><strong>Total lavados:</strong> ${totalLavados}</p>
                        ${recordatorioBtn}
                    </div>
                </div>
            </div>

            <h3>Historial de Servicios</h3>
            <div class="card">
                ${lavadosHtml}
            </div>
        `;

        document.getElementById('btn-volver-lista').addEventListener('click', renderMainView);
        document.getElementById('btn-editar-cliente').addEventListener('click', () => renderModalNuevoEditar(cliente));
        document.getElementById('btn-nuevo-lavado').addEventListener('click', () => {
            window.location.hash = `#/lavados/nuevo?clienteId=${cliente.id}`;
        });
        
        document.getElementById('btn-wpp-direct').addEventListener('click', () => {
            openWhatsApp(cliente.telefono, `Hola ${cliente.nombre}, te contactamos de Lavadero CF...`);
        });

        if (recordatorioBtn) {
            document.getElementById('btn-wpp-recordatorio').addEventListener('click', () => {
                whatsappRecordatorio(cliente.telefono, cliente.nombre, daysSince(clienteLavados[0].fecha));
            });
        }

    } catch (error) {
        console.error(error);
        toast('Error al cargar detalle del cliente', 'error');
    }
}


// -----------------------------------------------------------------------------
// MODAL: NUEVO / EDITAR CLIENTE
// -----------------------------------------------------------------------------
function renderModalNuevoEditar(clienteToEdit = null) {
    const isEdit = !!clienteToEdit;
    const modalId = 'modal-cliente';
    
    // Remove if exists
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const patentesArr = isEdit && clienteToEdit.patentes ? clienteToEdit.patentes : [''];

    const modalHtml = `
        <div id="${modalId}" class="modal" style="display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; display: flex;">
            <div class="card" style="width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; background: #fff;">
                <h2 style="margin-top: 0;">${isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                
                <div id="duplicate-warning" style="display: none; background: #fff3cd; color: #856404; padding: 10px; border-radius: 4px; margin-bottom: 15px; border: 1px solid #ffeeba;">
                    <p style="margin: 0 0 10px 0;" id="duplicate-msg"></p>
                    <button id="btn-ir-ficha-dup" class="btn btn-secondary btn-sm" style="background: #fff;">Ver Ficha</button>
                </div>

                <form id="form-cliente">
                    <div style="margin-bottom: 1rem;">
                        <label class="label">Nombre completo *</label>
                        <input type="text" class="input" id="cli-nombre" required value="${isEdit ? clienteToEdit.nombre : ''}">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label class="label">Teléfono * (Ej: 1155554444)</label>
                        <input type="tel" class="input" id="cli-telefono" required value="${isEdit ? clienteToEdit.telefono : ''}">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label class="label">Email (opcional)</label>
                        <input type="email" class="input" id="cli-email" value="${isEdit ? (clienteToEdit.email || '') : ''}">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label class="label">Patentes *</label>
                        <div id="patentes-container">
                            ${patentesArr.map((p, i) => `
                                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;" class="patente-row">
                                    <input type="text" class="input cli-patente" placeholder="AAA123 o AF123AB" style="text-transform: uppercase;" value="${p}" ${i===0?'required':''}>
                                    ${i > 0 ? `<button type="button" class="btn btn-secondary btn-remove-patente" style="padding: 0 10px;">X</button>` : ''}
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" id="btn-add-patente" class="btn btn-secondary btn-sm" style="margin-top: 0.5rem; padding: 4px 8px; font-size: 0.8rem;">+ Agregar patente</button>
                    </div>
                    
                    <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem;">
                        <button type="button" class="btn btn-secondary" id="btn-cancelar-modal">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btn-guardar-cliente">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById(modalId);
    const form = document.getElementById('form-cliente');
    const telInput = document.getElementById('cli-telefono');
    const patentesContainer = document.getElementById('patentes-container');
    const warningBox = document.getElementById('duplicate-warning');
    const warningMsg = document.getElementById('duplicate-msg');
    let duplicateId = null;

    document.getElementById('btn-cancelar-modal').addEventListener('click', () => modal.remove());
    
    document.getElementById('btn-add-patente').addEventListener('click', () => {
        const div = document.createElement('div');
        div.className = 'patente-row';
        div.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 0.5rem;';
        div.innerHTML = `
            <input type="text" class="input cli-patente" placeholder="AAA123 o AF123AB" style="text-transform: uppercase;">
            <button type="button" class="btn btn-secondary btn-remove-patente" style="padding: 0 10px;">X</button>
        `;
        patentesContainer.appendChild(div);
        
        div.querySelector('.btn-remove-patente').addEventListener('click', (e) => {
            e.target.parentElement.remove();
            checkDuplicates();
        });
        div.querySelector('.cli-patente').addEventListener('input', checkDuplicates);
    });

    // Remove buttons bindings for existing ones
    modal.querySelectorAll('.btn-remove-patente').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.parentElement.remove();
            checkDuplicates();
        });
    });

    document.getElementById('btn-ir-ficha-dup').addEventListener('click', (e) => {
        e.preventDefault();
        modal.remove();
        if (duplicateId) {
            renderDetailView(duplicateId);
        }
    });

    // Validation pattern for Argentina plates: AAA123 (old) or AA123AA (new) - roughly [a-z]{3}\d{3} or [a-z]{2}\d{3}[a-z]{2}
    const isPatenteValid = (p) => {
        const val = p.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        return /^[A-Z]{3}\d{3}$/.test(val) || /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(val) || /^[A-Z]{3}\d{4}$/.test(val); // Added motos maybe
    };

    // Duplicate check logic
    let dupTimeout;
    const checkDuplicates = async () => {
        if (isEdit) return; // Don't check on edit, or at least ignore current user
        clearTimeout(dupTimeout);
        dupTimeout = setTimeout(async () => {
            const tel = telInput.value.trim();
            const patentes = Array.from(modal.querySelectorAll('.cli-patente')).map(i => i.value.trim().toUpperCase()).filter(Boolean);
            
            if (!tel && patentes.length === 0) {
                warningBox.style.display = 'none';
                document.getElementById('btn-guardar-cliente').disabled = false;
                return;
            }

            try {
                const clientes = await db.getAll('clientes');
                const dup = clientes.find(c => {
                    const telMatch = tel && c.telefono === tel;
                    const patMatch = patentes.some(p => (c.patentes || []).includes(p));
                    return telMatch || patMatch;
                });

                if (dup) {
                    duplicateId = dup.id;
                    warningMsg.textContent = `Este teléfono o patente ya está registrado a nombre de ${dup.nombre}.`;
                    warningBox.style.display = 'block';
                    document.getElementById('btn-guardar-cliente').disabled = true;
                } else {
                    duplicateId = null;
                    warningBox.style.display = 'none';
                    document.getElementById('btn-guardar-cliente').disabled = false;
                }
            } catch (err) {
                console.error("Error checking duplicates", err);
            }
        }, 500);
    };

    telInput.addEventListener('input', checkDuplicates);
    modal.querySelectorAll('.cli-patente').forEach(i => i.addEventListener('input', checkDuplicates));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (duplicateId && !isEdit) return; // Prevent save if duplicate detected on new

        const nombre = document.getElementById('cli-nombre').value.trim();
        const telefono = document.getElementById('cli-telefono').value.trim();
        const email = document.getElementById('cli-email').value.trim();
        
        let patentes = Array.from(modal.querySelectorAll('.cli-patente'))
            .map(i => i.value.trim().toUpperCase())
            .filter(Boolean);
        
        // Remove duplicates within the array itself
        patentes = [...new Set(patentes)];

        if (!nombre || !telefono || patentes.length === 0) {
            toast('Por favor, completá nombre, teléfono y al menos una patente.', 'error');
            return;
        }

        // Validate patentes
        for (const p of patentes) {
            if (!isPatenteValid(p)) {
                toast(`El formato de la patente "${p}" no es válido (ej: AAA123 o AA123AA).`, 'error');
                return;
            }
        }

        const clienteData = {
            nombre,
            telefono,
            email,
            patentes,
            fechaActualizacion: new Date().toISOString()
        };

        try {
            if (isEdit) {
                clienteData.id = clienteToEdit.id;
                clienteData.fechaAlta = clienteToEdit.fechaAlta; // preserve
                await db.put('clientes', clienteData);
                toast('Cliente actualizado correctamente', 'success');
            } else {
                clienteData.fechaAlta = new Date().toISOString();
                await db.add('clientes', clienteData);
                toast('Cliente creado correctamente', 'success');
            }
            
            modal.remove();
            
            if (isEdit) {
                renderDetailView(clienteData.id);
            } else {
                await renderMainView();
            }
        } catch (error) {
            console.error(error);
            toast('Error al guardar el cliente', 'error');
        }
    });
}


// -----------------------------------------------------------------------------
// MODAL: IMPORTAR CSV
// -----------------------------------------------------------------------------
function renderModalImportCSV() {
    const modalId = 'modal-import-csv';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modalHtml = `
        <div id="${modalId}" class="modal" style="display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; display: flex;">
            <div class="card" style="width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; background: #fff;">
                <h2 style="margin-top: 0;">Importar Clientes (CSV)</h2>
                <div style="margin-bottom: 1rem; color: #555; font-size: 0.9rem;">
                    <p>El archivo CSV debe tener los encabezados exactos en la primera fila:</p>
                    <code style="display:block; padding: 10px; background: #eee; margin-top: 5px;">nombre, telefono, patente, email</code>
                    <p style="margin-top: 10px;">Si el cliente tiene varias patentes, separalas por espacios o guiones.</p>
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <input type="file" id="csv-file-input" accept=".csv" class="input">
                </div>

                <div id="csv-preview-container" style="display: none; margin-bottom: 1rem;">
                    <h4>Vista previa (Primeros 5 registros):</h4>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 0.8rem;">
                            <thead>
                                <tr style="border-bottom: 2px solid #ddd;"><th style="padding: 4px;">Nombre</th><th style="padding: 4px;">Teléfono</th><th style="padding: 4px;">Patente(s)</th></tr>
                            </thead>
                            <tbody id="csv-preview-body"></tbody>
                        </table>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem;">
                    <button class="btn btn-secondary" id="btn-cancelar-csv">Cancelar</button>
                    <button class="btn btn-primary" id="btn-confirmar-csv" disabled>Importar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById(modalId);
    const fileInput = document.getElementById('csv-file-input');
    const previewContainer = document.getElementById('csv-preview-container');
    const previewBody = document.getElementById('csv-preview-body');
    const btnConfirmar = document.getElementById('btn-confirmar-csv');
    let parsedData = null;

    document.getElementById('btn-cancelar-csv').addEventListener('click', () => modal.remove());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            previewContainer.style.display = 'none';
            btnConfirmar.disabled = true;
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            // Simple CSV parsing for preview
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length < 2) {
                toast('El archivo está vacío o no tiene encabezados válidos', 'error');
                return;
            }

            const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
            const hasRequired = ['nombre', 'telefono', 'patente'].every(req => headers.includes(req));
            
            if (!hasRequired) {
                toast('Faltan columnas requeridas (nombre, telefono, patente)', 'error');
                return;
            }

            // Mapear data
            parsedData = lines.slice(1).map(line => {
                const values = line.split(',');
                let obj = {};
                headers.forEach((h, i) => {
                    obj[h] = (values[i] || '').trim();
                });
                return obj;
            });

            // Mostrar preview
            const previewRows = parsedData.slice(0, 5);
            previewBody.innerHTML = previewRows.map(row => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 4px;">${row.nombre || '-'}</td>
                    <td style="padding: 4px;">${row.telefono || '-'}</td>
                    <td style="padding: 4px;">${row.patente || '-'}</td>
                </tr>
            `).join('');
            
            previewContainer.style.display = 'block';
            btnConfirmar.disabled = false;
        };
        reader.onerror = () => {
            toast('Error al leer el archivo', 'error');
        };
        reader.readAsText(file);
    });

    btnConfirmar.addEventListener('click', async () => {
        if (!parsedData || parsedData.length === 0) return;
        
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Importando...';

        try {
            let importados = 0;
            let duplicados = 0;
            
            const existingClientes = await db.getAll('clientes');
            
            for (const row of parsedData) {
                if (!row.nombre || !row.telefono || !row.patente) continue;

                // Check dups by tel
                if (existingClientes.some(c => c.telefono === row.telefono)) {
                    duplicados++;
                    continue;
                }

                // Process patentes (split by space or dash)
                const patentes = row.patente.toUpperCase().split(/[-\s]+/).filter(Boolean);

                const newCliente = {
                    nombre: row.nombre,
                    telefono: row.telefono,
                    email: row.email || '',
                    patentes,
                    fechaAlta: new Date().toISOString(),
                    fechaActualizacion: new Date().toISOString()
                };

                await db.add('clientes', newCliente);
                existingClientes.push(newCliente); // add to local check to avoid dups in same csv
                importados++;
            }

            toast(`${importados} clientes importados, ${duplicados} duplicados omitidos.`, importados > 0 ? 'success' : 'warning');
            modal.remove();
            await renderMainView();

        } catch (error) {
            console.error(error);
            toast('Ocurrió un error al importar los clientes', 'error');
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = 'Importar';
        }
    });
}
