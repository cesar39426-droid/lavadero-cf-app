import { db } from '../db/db.js';
import { auth } from '../auth.js';
import { toast } from '../utils/toast.js';

export async function render(container) {
    const user = auth.getCurrentUser();
    
    // Obtener configuración (asumiendo método auxiliar o store config)
    let config = {};
    try {
        if (db.getConfig) {
            config = await db.getConfig() || {};
        } else if (db.get) {
            config = await db.get('config', 'settings') || {};
        }
    } catch (e) {
        console.warn('No se pudo cargar la configuración', e);
    }

    const businessName = config.businessName || 'LavaderoCF';
    const businessPhone = config.businessPhone || '';
    const aiApiKey = config.api_key_ia || '';
    const lastBackup = config.lastBackup || 'Nunca';
    const appVersion = config.version || '1.0.0';
    
    // URL Pública para reservas
    const publicUrl = window.location.origin + window.location.pathname + '#/reserva';

    container.innerHTML = `
        <div class="config-module">
            <h2 class="page-title">Configuración</h2>
            
            <section class="config-section">
                <h3>Datos del Negocio</h3>
                <div class="form-group">
                    <label for="cfg-business-name">Nombre del Negocio</label>
                    <input type="text" id="cfg-business-name" value="${businessName}">
                </div>
                <div class="form-group">
                    <label for="cfg-business-phone">Teléfono (WhatsApp)</label>
                    <input type="tel" id="cfg-business-phone" value="${businessPhone}" placeholder="+54 9 11 1234-5678">
                </div>
                <button id="btn-save-business" class="btn btn-primary">Guardar cambios</button>
            </section>

            <section class="config-section">
                <h3>Copia de Seguridad</h3>
                <p>Última exportación: <strong id="last-backup-date">${lastBackup}</strong></p>
                <div class="button-group mt-2">
                    <button id="btn-export-backup" class="btn btn-secondary">Descargar copia de seguridad (.json)</button>
                    <input type="file" id="input-import-backup" accept=".json" style="display: none;">
                    <button id="btn-import-backup" class="btn btn-secondary">Restaurar desde copia de seguridad</button>
                </div>
            </section>

            <section class="config-section">
                <h3>Inteligencia Artificial</h3>
                <div class="ai-status mb-2">
                    Estado: <span id="ai-status-badge" class="badge ${aiApiKey ? 'badge-connected' : 'badge-local'}">${aiApiKey ? 'IA Conectada ✓' : 'IA Local'}</span>
                </div>
                <p class="text-sm">Conecta tu cuenta de Grok para obtener recomendaciones potenciadas por IA. Sin clave, el sistema usa análisis local.</p>
                <div class="form-group mt-2">
                    <label for="cfg-ai-key">API Key de IA (Grok)</label>
                    <div class="input-group">
                        <input type="password" id="cfg-ai-key" value="${aiApiKey}" placeholder="gsk_...">
                        <button id="btn-toggle-ai-key" class="btn btn-icon" title="Mostrar/Ocultar" type="button">👁️</button>
                    </div>
                </div>
                <div class="button-group">
                    <button id="btn-save-ai-key" class="btn btn-primary">Guardar API Key</button>
                    <button id="btn-test-ai-key" class="btn btn-secondary">Probar conexión</button>
                </div>
            </section>

            <section class="config-section">
                <h3>Link de Reservas Público</h3>
                <p class="text-sm">Compartí este link o QR con tus clientes para que puedan reservar turno.</p>
                <div class="public-link-box mt-2">
                    <input type="text" id="cfg-public-url" value="${publicUrl}" readonly>
                    <button id="btn-copy-link" class="btn btn-secondary">Copiar link</button>
                </div>
                <button id="btn-view-qr" class="btn btn-secondary mt-2">Ver QR</button>
                <div id="qr-container" class="mt-2 text-center" style="display: none;">
                    <img id="qr-image" src="" alt="Código QR" style="max-width: 200px; border-radius: 8px;">
                </div>
            </section>

            <section class="config-section danger-zone">
                <h3>Gestión de la App</h3>
                <p class="text-sm mb-2">Versión de la app: <strong>${appVersion}</strong></p>
                <button id="btn-logout" class="btn btn-secondary w-100 mb-4">Cerrar sesión</button>
                
                ${user && user.role === 'dueño' ? `
                <div class="delete-data-zone mt-4 pt-4 border-top">
                    <h4 class="text-danger">Zona de Peligro</h4>
                    <p class="text-sm">Para borrar todos los datos, escribí <strong>CONFIRMAR</strong> abajo:</p>
                    <input type="text" id="input-confirm-delete" placeholder="CONFIRMAR" class="mt-2 mb-2 w-100">
                    <button id="btn-delete-all" class="btn btn-danger w-100" disabled>Borrar todos los datos</button>
                </div>
                ` : ''}
            </section>
        </div>

        <style>
            .config-module {
                padding: 1rem;
                max-width: 800px;
                margin: 0 auto;
                color: var(--color-negro, #000000);
            }
            .page-title {
                font-family: 'Playfair Display', serif;
                margin-bottom: 1.5rem;
                color: var(--color-dorado, #c9a227);
            }
            .config-section {
                background: var(--color-blanco-hueso, #f5f0e8);
                padding: 1.5rem;
                margin-bottom: 1.5rem;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }
            .config-section h3 {
                margin-top: 0;
                margin-bottom: 1rem;
                font-family: 'Playfair Display', serif;
                font-size: 1.25rem;
                border-bottom: 2px solid var(--color-dorado, #c9a227);
                padding-bottom: 0.5rem;
                display: inline-block;
            }
            .form-group { margin-bottom: 1rem; }
            .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.9rem; }
            .form-group input { width: 100%; padding: 0.75rem; border: 1px solid #ccc; border-radius: 6px; font-family: inherit; }
            .input-group { display: flex; gap: 0.5rem; }
            
            .btn {
                padding: 0.75rem 1rem;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                text-align: center;
                transition: opacity 0.2s;
                font-family: inherit;
                min-height: 48px;
            }
            .btn:active { opacity: 0.8; }
            .btn-primary { background: var(--color-dorado, #c9a227); color: #000; }
            .btn-secondary { background: #333; color: #fff; }
            .btn-danger { background: #dc3545; color: #fff; }
            .btn-icon { background: #e0d8cc; border: none; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; width: 48px; }
            .btn:disabled { opacity: 0.5; cursor: not-allowed; }
            
            .button-group { display: flex; gap: 1rem; flex-wrap: wrap; }
            .mt-2 { margin-top: 0.5rem; }
            .mt-4 { margin-top: 1.5rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-4 { margin-bottom: 1.5rem; }
            .pt-4 { padding-top: 1.5rem; }
            .w-100 { width: 100%; }
            .text-sm { font-size: 0.9rem; color: #555; margin: 0; }
            .text-danger { color: #dc3545; }
            .text-center { text-align: center; }
            .border-top { border-top: 1px solid #ddd; }
            
            .badge { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; color: #fff; font-weight: bold; }
            .badge-connected { background: #28a745; }
            .badge-local { background: #6c757d; }
            
            .public-link-box { display: flex; gap: 0.5rem; align-items: stretch; }
            .public-link-box input { flex: 1; margin: 0; background: #fff; }
            
            .danger-zone { border: 2px dashed #dc3545; background: #fff5f5; }
            
            @media (max-width: 600px) {
                .button-group, .public-link-box { flex-direction: column; }
                .btn { width: 100%; }
            }
        </style>
    `;
}

// Función auxiliar para actualizar config
async function updateConfig(key, value) {
    try {
        if (db.getConfig && db.setConfig) {
            const config = await db.getConfig() || {};
            config[key] = value;
            await db.setConfig(config);
        } else if (db.get && db.put) {
            const config = await db.get('config', 'settings') || { id: 'settings' };
            config[key] = value;
            await db.put('config', config);
        }
    } catch (e) {
        console.error('Error al actualizar config:', e);
        throw e;
    }
}

export async function init() {
    // 1. Datos del Negocio
    const btnSaveBusiness = document.getElementById('btn-save-business');
    if (btnSaveBusiness) {
        btnSaveBusiness.addEventListener('click', async () => {
            const name = document.getElementById('cfg-business-name').value.trim();
            const phone = document.getElementById('cfg-business-phone').value.trim();
            
            try {
                await updateConfig('businessName', name);
                await updateConfig('businessPhone', phone);
                toast('Datos del negocio guardados correctamente.');
            } catch (error) {
                toast('Error al guardar datos.', 'error');
            }
        });
    }

    // 2. Copia de Seguridad
    const btnExport = document.getElementById('btn-export-backup');
    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            try {
                if (!db.exportAllData) {
                    throw new Error('Método exportAllData no implementado en db.js');
                }
                const data = await db.exportAllData();
                const jsonStr = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const date = new Date().toISOString().split('T')[0];
                const filename = \`lavaderocf-backup-\${date}.json\`;
                
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                const todayFormatted = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(new Date());
                await updateConfig('lastBackup', todayFormatted);
                
                document.getElementById('last-backup-date').textContent = todayFormatted;
                toast('Copia de seguridad descargada exitosamente.');
            } catch (error) {
                console.error(error);
                toast('Error al exportar datos.', 'error');
            }
        });
    }

    const btnImport = document.getElementById('btn-import-backup');
    const inputImport = document.getElementById('input-import-backup');
    if (btnImport && inputImport) {
        btnImport.addEventListener('click', () => {
            inputImport.click();
        });
        
        inputImport.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (confirm('⚠️ Esto reemplazará TODOS los datos actuales con los del archivo. ¿Estás seguro?')) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        if (!db.importAllData) {
                            throw new Error('Método importAllData no implementado en db.js');
                        }
                        const data = JSON.parse(event.target.result);
                        await db.importAllData(data);
                        toast('Datos restaurados correctamente. Recargando app...', 'success');
                        setTimeout(() => window.location.reload(), 1500);
                    } catch (error) {
                        console.error(error);
                        toast('El archivo no es válido o está dañado.', 'error');
                    }
                };
                reader.readAsText(file);
            }
            inputImport.value = ''; // Reset input for future imports
        });
    }

    // 3. Inteligencia Artificial (Hook Externo)
    const btnToggleAi = document.getElementById('btn-toggle-ai-key');
    const inputAi = document.getElementById('cfg-ai-key');
    if (btnToggleAi && inputAi) {
        btnToggleAi.addEventListener('click', () => {
            if (inputAi.type === 'password') {
                inputAi.type = 'text';
                btnToggleAi.textContent = '🙈';
            } else {
                inputAi.type = 'password';
                btnToggleAi.textContent = '👁️';
            }
        });
    }

    const btnSaveAi = document.getElementById('btn-save-ai-key');
    const badgeAi = document.getElementById('ai-status-badge');
    if (btnSaveAi) {
        btnSaveAi.addEventListener('click', async () => {
            const key = inputAi.value.trim();
            try {
                await updateConfig('api_key_ia', key);
                
                if (key) {
                    badgeAi.textContent = 'IA Conectada ✓';
                    badgeAi.className = 'badge badge-connected';
                } else {
                    badgeAi.textContent = 'IA Local';
                    badgeAi.className = 'badge badge-local';
                }
                
                toast('API Key de IA guardada.');
            } catch (error) {
                toast('Error al guardar API Key.', 'error');
            }
        });
    }

    const btnTestAi = document.getElementById('btn-test-ai-key');
    if (btnTestAi) {
        btnTestAi.addEventListener('click', async () => {
            const key = inputAi.value.trim();
            if (!key) {
                toast('Ingresá una API Key primero para probar.', 'error');
                return;
            }
            toast('Probando conexión con IA...');
            try {
                // Prueba de API simple contra un endpoint público que requiera Auth
                // (Grok compatible API via xAI o Groq)
                const res = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': \`Bearer \${key}\` }
                });
                
                if (res.ok) {
                    toast('Conexión exitosa con la IA.', 'success');
                } else {
                    toast('Error de autenticación. Verificá tu clave.', 'error');
                }
            } catch (error) {
                toast('Error de red al conectar con IA.', 'error');
            }
        });
    }

    // 4. Link de Reservas Público
    const btnCopyLink = document.getElementById('btn-copy-link');
    const inputUrl = document.getElementById('cfg-public-url');
    if (btnCopyLink && inputUrl) {
        btnCopyLink.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(inputUrl.value);
                toast('Link copiado al portapapeles.');
            } catch (err) {
                // Fallback for older browsers
                inputUrl.select();
                document.execCommand('copy');
                toast('Link copiado al portapapeles.');
            }
        });
    }

    const btnViewQr = document.getElementById('btn-view-qr');
    const qrContainer = document.getElementById('qr-container');
    const qrImage = document.getElementById('qr-image');
    if (btnViewQr && qrContainer && qrImage && inputUrl) {
        btnViewQr.addEventListener('click', () => {
            if (qrContainer.style.display === 'none') {
                const encodedUrl = encodeURIComponent(inputUrl.value);
                qrImage.src = \`https://api.qrserver.com/v1/create-qr-code/?data=\${encodedUrl}&size=200x200\`;
                qrContainer.style.display = 'block';
                btnViewQr.textContent = 'Ocultar QR';
            } else {
                qrContainer.style.display = 'none';
                btnViewQr.textContent = 'Ver QR';
            }
        });
    }

    // 5. Gestión de la App
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (auth.logout) {
                auth.logout();
            }
            window.location.hash = '#/login';
            toast('Sesión cerrada correctamente.');
        });
    }

    const inputConfirm = document.getElementById('input-confirm-delete');
    const btnDeleteAll = document.getElementById('btn-delete-all');
    if (inputConfirm && btnDeleteAll) {
        inputConfirm.addEventListener('input', (e) => {
            btnDeleteAll.disabled = e.target.value !== 'CONFIRMAR';
        });
        
        btnDeleteAll.addEventListener('click', async () => {
            if (confirm('⚠️ ATENCIÓN: Esta acción es irreversible y borrará toda la base de datos de tu dispositivo. ¿Seguro que querés continuar?')) {
                try {
                    // Resetear base de datos
                    if (db.clearAllData) {
                        await db.clearAllData();
                    } else if (db.deleteDatabase) {
                        await db.deleteDatabase();
                    }
                    if (auth.logout) auth.logout();
                    toast('Todos los datos fueron borrados de este dispositivo.', 'success');
                    setTimeout(() => {
                        window.location.hash = '#/login';
                        window.location.reload();
                    }, 1000);
                } catch (error) {
                    console.error(error);
                    toast('Error al borrar los datos.', 'error');
                }
            }
        });
    }
}
