import { db } from '../db/db.js';
import { auth } from '../auth.js';
import { toast } from '../utils/toast.js';
import { formatMoney } from '../utils/format.js';

export async function generarRecomendaciones() {
    const recomendaciones = [];
    try {
        const lavados = await db.getAll('lavados') || [];
        const costos = await db.getAll('costos') || [];
        const empleados = await db.getAll('empleados') || [];
        const clientes = await db.getAll('clientes') || [];
        
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

        // 1. Margen de servicios
        const lavadosRecientes = lavados.filter(l => new Date(l.fechaInicio) >= thirtyDaysAgo && l.estado === 'completado');
        const ingresosRecientes = lavadosRecientes.reduce((sum, l) => sum + (Number(l.precio) || 0), 0);
        
        const costosRecientes = costos.filter(c => new Date(c.fecha) >= thirtyDaysAgo);
        const gastosRecientes = costosRecientes.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
        
        if (ingresosRecientes > 0) {
            const margen = (ingresosRecientes - gastosRecientes) / ingresosRecientes;
            if (margen < 0.40) {
                recomendaciones.push({
                    titulo: 'Margen de rentabilidad bajo',
                    descripcion: `El margen global de los últimos 30 días está por debajo del 40%. Ingresos: ${formatMoney(ingresosRecientes)}, Costos: ${formatMoney(gastosRecientes)}. Sugerimos revisar precios o reducir costos.`,
                    tipo: 'rentabilidad',
                    icono: '📉',
                    prioridad: 'alta'
                });
            }
        }

        // 2. Días de la semana con menos de 2 lavados promedio
        const lavadosPorDia = [0,0,0,0,0,0,0];
        lavadosRecientes.forEach(l => {
            const d = new Date(l.fechaInicio).getDay();
            lavadosPorDia[d]++;
        });
        
        const diasSemanales = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        for(let i=0; i<7; i++) {
            if (lavadosPorDia[i] / 4 < 2) {
                recomendaciones.push({
                    titulo: `Baja demanda los ${diasSemanales[i]}s`,
                    descripcion: `Promedio menor a 2 lavados los ${diasSemanales[i]}s. Sugerimos lanzar una promoción específica para este día.`,
                    tipo: 'demanda',
                    icono: '📅',
                    prioridad: 'media'
                });
                break; // Solo sugerir uno
            }
        }

        // 3. Dependencia de un servicio (>70% de ingresos)
        const ingresosPorServicio = {};
        lavadosRecientes.forEach(l => {
            const s = l.servicio || 'Desconocido';
            ingresosPorServicio[s] = (ingresosPorServicio[s] || 0) + (Number(l.precio) || 0);
        });
        
        for (const [srv, monto] of Object.entries(ingresosPorServicio)) {
            if (ingresosRecientes > 0 && (monto / ingresosRecientes) > 0.70) {
                recomendaciones.push({
                    titulo: 'Alta dependencia de servicio',
                    descripcion: `El servicio "${srv}" representa más del 70% de los ingresos. Existe riesgo de dependencia. Intente promocionar otros servicios.`,
                    tipo: 'rentabilidad',
                    icono: '⚠️',
                    prioridad: 'media'
                });
            }
        }

        // 4. Tasa de clientes recurrentes < 30%
        const clientesConLavados = new Set(lavadosRecientes.map(l => l.clienteId));
        let clientesRecurrentesCount = 0;
        
        clientesConLavados.forEach(cId => {
            const lavadosDeEsteCliente = lavados.filter(l => l.clienteId === cId && l.estado === 'completado');
            if (lavadosDeEsteCliente.length > 1) {
                clientesRecurrentesCount++;
            }
        });
        
        if (clientesConLavados.size > 0 && (clientesRecurrentesCount / clientesConLavados.size) < 0.30) {
            recomendaciones.push({
                titulo: 'Baja retención de clientes',
                descripcion: 'Menos del 30% de los clientes recientes son recurrentes. Sugerimos implementar un programa de fidelización.',
                tipo: 'clientes',
                icono: '👥',
                prioridad: 'alta'
            });
        }

        // 5. Más de 10 recordatorios de 30 días pendientes
        let clientesAtrasados = 0;
        clientes.forEach(cliente => {
            const lavadosCliente = lavados.filter(l => l.clienteId === cliente.id && l.estado === 'completado');
            if (lavadosCliente.length > 0) {
                lavadosCliente.sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));
                const dias = (now.getTime() - new Date(lavadosCliente[0].fechaInicio).getTime()) / (1000 * 3600 * 24);
                if (dias >= 30) clientesAtrasados++;
            }
        });
        
        if (clientesAtrasados > 10) {
            recomendaciones.push({
                titulo: 'Mantenimientos atrasados',
                descripcion: `Hay ${clientesAtrasados} clientes con más de 30 días sin lavados. Revise la sección Recordatorios de inmediato para contactarlos.`,
                tipo: 'clientes',
                icono: '🔔',
                prioridad: 'alta'
            });
        }

        // 6. Productividad de empleado baja
        if (empleados.length > 1) {
            const lavadosPorEmpleado = {};
            empleados.forEach(e => lavadosPorEmpleado[e.id] = 0);
            
            lavadosRecientes.forEach(l => {
                if (l.empleadoId && lavadosPorEmpleado[l.empleadoId] !== undefined) {
                    lavadosPorEmpleado[l.empleadoId]++;
                }
            });
            
            const totalLavadosAsignados = Object.values(lavadosPorEmpleado).reduce((a,b)=>a+b, 0);
            const promedio = totalLavadosAsignados / empleados.length;
            
            empleados.forEach(emp => {
                if (lavadosPorEmpleado[emp.id] < promedio * 0.5) {
                    recomendaciones.push({
                        titulo: `Baja productividad: ${emp.nombre}`,
                        descripcion: `Este empleado tiene un rendimiento notablemente más bajo que el promedio en los últimos 30 días.`,
                        tipo: 'empleados',
                        icono: '👤',
                        prioridad: 'media'
                    });
                }
            });
        }

        // 7. Ticket promedio semanal < mensual
        const lavadosSemana = lavadosRecientes.filter(l => new Date(l.fechaInicio) >= sevenDaysAgo);
        const ingresosSemana = lavadosSemana.reduce((sum, l) => sum + (Number(l.precio) || 0), 0);
        const ticketSemanal = lavadosSemana.length ? ingresosSemana / lavadosSemana.length : 0;
        const ticketMensual = lavadosRecientes.length ? ingresosRecientes / lavadosRecientes.length : 0;
        
        if (ticketSemanal > 0 && ticketMensual > 0 && ticketSemanal < ticketMensual * 0.85) {
            recomendaciones.push({
                titulo: 'Caída del ticket promedio',
                descripcion: `El ticket promedio de esta semana (${formatMoney(ticketSemanal)}) está por debajo del promedio mensual (${formatMoney(ticketMensual)}).`,
                tipo: 'precio',
                icono: '💰',
                prioridad: 'alta'
            });
        }

        // 8. Turnos sin empleado asignado
        const turnosPendientes = lavados.filter(l => l.estado === 'pendiente');
        const sinAsignar = turnosPendientes.filter(l => !l.empleadoId).length;
        if (sinAsignar > 0) {
            recomendaciones.push({
                titulo: 'Turnos sin asignación',
                descripcion: `Hay ${sinAsignar} turnos pendientes sin empleado asignado. Organice el equipo para cubrir la demanda.`,
                tipo: 'empleados',
                icono: '📋',
                prioridad: 'media'
            });
        }

        // 9. Sin costos cargados últimos 7 días
        const costosSemana = costos.filter(c => new Date(c.fecha) >= sevenDaysAgo);
        if (costosSemana.length === 0) {
            recomendaciones.push({
                titulo: 'Costos no actualizados',
                descripcion: 'No se han registrado costos o gastos en los últimos 7 días. Mantenga el registro al día para cálculos precisos.',
                tipo: 'rentabilidad',
                icono: '📝',
                prioridad: 'baja'
            });
        }

        // 10. Más de 3 lavados en cola
        const hoyStr = now.toISOString().split('T')[0];
        const turnosHoy = turnosPendientes.filter(l => l.fechaInicio.startsWith(hoyStr));
        if (turnosHoy.length > 3) {
            recomendaciones.push({
                titulo: 'Alta congestión de turnos',
                descripcion: 'Hay más de 3 lavados en cola para hoy. Considere llamar a un refuerzo o reestructurar horarios.',
                tipo: 'empleados',
                icono: '🚗',
                prioridad: 'alta'
            });
        }

    } catch (error) {
        console.error('Error generando recomendaciones:', error);
    }
    return recomendaciones;
}

export async function render(container) {
    container.innerHTML = `
        <div class="module-header d-flex justify-content-between align-items-center mb-4">
            <h2 class="m-0">Recomendaciones Inteligentes</h2>
            <span id="ia-badge" class="badge">Analizando...</span>
        </div>
        
        <div class="card p-4 mb-4" id="ia-externa-container">
            <!-- Dinámico: Se llena con Conectar o Consultar -->
        </div>

        <div id="recomendaciones-list" class="items-list d-flex flex-column gap-3">
            <div class="loading-state">Analizando negocio...</div>
        </div>
    `;
}

export async function init() {
    if (!auth.isAuthenticated()) return;

    const listContainer = document.getElementById('recomendaciones-list');
    const badge = document.getElementById('ia-badge');
    const externaContainer = document.getElementById('ia-externa-container');

    // Revisar configuración de IA
    const config = await db.getAll('configuracion') || [];
    const grokKeySetting = config.find(c => c.key === 'grok_api_key');
    const apiKey = grokKeySetting ? grokKeySetting.value : null;

    if (apiKey) {
        badge.textContent = 'IA Conectada';
        badge.className = 'badge bg-success';
        externaContainer.innerHTML = `
            <h3 class="mb-2">Consultar a Grok (IA)</h3>
            <p class="text-sm mb-3 text-muted">Haga preguntas específicas sobre su negocio y Grok responderá analizando sus datos en tiempo real.</p>
            <div class="form-group d-flex gap-2">
                <input type="text" id="grok-input" class="form-control flex-grow-1" placeholder="Ej: ¿Qué servicios promociono esta semana?">
                <button id="btn-grok" class="btn btn-primary">Consultar</button>
            </div>
            <div id="grok-response" class="mt-3 text-gold d-none p-3 border border-gold rounded bg-dark"></div>
        `;

        document.getElementById('btn-grok').addEventListener('click', async () => {
            const input = document.getElementById('grok-input').value;
            if (!input) return;
            const resContainer = document.getElementById('grok-response');
            resContainer.classList.remove('d-none');
            resContainer.innerHTML = '<i>Grok está pensando...</i>';
            
            try {
                // HOOK IA EXTERNA — Reemplazar con la llamada real a la API
                // const res = await fetch('https://api.grok.ai/v1/chat/completions', {
                //     method: 'POST',
                //     headers: { 'Authorization': \`Bearer \${apiKey}\`, 'Content-Type': 'application/json' },
                //     body: JSON.stringify({ messages: [{role: 'user', content: input}] })
                // });
                // const data = await res.json();
                
                setTimeout(() => {
                    resContainer.innerHTML = \`<p class="m-0"><strong>Grok dice:</strong> Simulación de respuesta para "\${input}". (Se requiere implementar el endpoint real de la API de Grok).</p>\`;
                }, 1500);
            } catch (error) {
                console.error(error);
                resContainer.innerHTML = '<span class="text-danger">Error de conexión con IA Externa.</span>';
            }
        });

    } else {
        badge.textContent = 'IA Local';
        badge.className = 'badge bg-gold text-dark';
        externaContainer.innerHTML = `
            <h3 class="mb-2">Conectar IA Externa (Opcional)</h3>
            <p class="text-sm mb-3 text-muted">Conecte la API de Grok para hacer consultas libres en lenguaje natural sobre las estadísticas del lavadero.</p>
            <a href="#/dueno/config" class="btn btn-outline-primary">Configurar API Key</a>
        `;
    }

    try {
        const recomendaciones = await generarRecomendaciones();
        
        if (recomendaciones.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state card p-5 text-center">
                    <span class="empty-icon d-block mb-3" style="font-size: 3rem;">✅</span>
                    <p class="m-0 text-muted">¡Su negocio está funcionando óptimamente! No hay recomendaciones por el momento.</p>
                </div>
            `;
            return;
        }

        // Ordenar por prioridad (alta > media > baja)
        const ordenPri = { 'alta': 1, 'media': 2, 'baja': 3 };
        recomendaciones.sort((a, b) => ordenPri[a.prioridad] - ordenPri[b.prioridad]);

        listContainer.innerHTML = recomendaciones.map(r => {
            let colorClase = 'bg-success'; // baja
            let textoPri = 'Baja Prioridad';
            if (r.prioridad === 'alta') {
                colorClase = 'bg-danger';
                textoPri = 'Alta Prioridad';
            } else if (r.prioridad === 'media') {
                colorClase = 'bg-warning text-dark';
                textoPri = 'Prioridad Media';
            }

            return `
                <div class="list-item card p-3 d-flex flex-row align-items-start gap-3">
                    <div class="item-icon bg-dark rounded p-2" style="font-size: 2rem;">${r.icono}</div>
                    <div class="item-content flex-grow-1">
                        <div class="item-header d-flex justify-content-between align-items-center mb-2">
                            <h3 class="m-0 text-gold">${r.titulo}</h3>
                            <span class="badge ${colorClase}">${textoPri}</span>
                        </div>
                        <p class="m-0 text-muted text-sm">${r.descripcion}</p>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error(error);
        listContainer.innerHTML = '<div class="error-state text-danger">Error al cargar recomendaciones</div>';
    }
}
