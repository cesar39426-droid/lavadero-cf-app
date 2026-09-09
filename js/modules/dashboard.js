import { db } from '../db/db.js';
import { auth } from '../auth.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { barChart, lineChart } from '../utils/charts.js';
import { generarRecomendaciones } from './ia.js';

let currentPeriod = 'hoy'; // hoy, semana, mes

export async function render(container) {
  container.innerHTML = `
    <div class="dashboard-header">
      <h2>Panel de Control</h2>
      <div class="reminders-badge" id="remindersBadge" style="cursor: pointer;" title="Clientes con 30+ días sin lavar">
        <span class="icon">🔔</span>
        <span id="remindersCount" class="count skeleton-text">&nbsp;&nbsp;</span> Recordatorios
      </div>
    </div>
    
    <div class="period-selector">
      <button class="period-btn active" data-period="hoy">Hoy</button>
      <button class="period-btn" data-period="semana">Esta semana</button>
      <button class="period-btn" data-period="mes">Este mes</button>
    </div>

    <div class="kpi-grid">
      <div class="stat-card">
        <h3>Ingresos</h3>
        <p id="kpiIngresos" class="skeleton-text">&nbsp;</p>
      </div>
      <div class="stat-card">
        <h3>Lavados</h3>
        <p id="kpiLavados" class="skeleton-text">&nbsp;</p>
      </div>
      <div class="stat-card">
        <h3>Ticket Promedio</h3>
        <p id="kpiTicket" class="skeleton-text">&nbsp;</p>
      </div>
      <div class="stat-card">
        <h3>Recurrentes</h3>
        <p id="kpiRecurrentes" class="skeleton-text">&nbsp;</p>
      </div>
    </div>

    <div class="charts-section">
      <div class="chart-container">
        <h3>Ingresos vs Costos (Últimos 7 días)</h3>
        <canvas id="revenueCostsChart"></canvas>
      </div>
      <div class="chart-container">
        <h3>Margen por Servicio</h3>
        <canvas id="marginChart"></canvas>
      </div>
    </div>

    <div class="bottom-section">
      <div class="employee-ranking">
        <h3>Ranking de Empleados (Esta semana)</h3>
        <ul id="employeeList">
          <li class="skeleton-text">&nbsp;</li>
          <li class="skeleton-text">&nbsp;</li>
        </ul>
      </div>

      <div class="ai-recommendations">
        <h3>Recomendaciones Inteligentes</h3>
        <ul id="iaList">
          <li class="skeleton-text">&nbsp;</li>
        </ul>
        <button id="btnVerTodasIA" class="btn-primary">Ver todas las recomendaciones</button>
      </div>
    </div>
  `;
}

export async function init() {
  setupEventListeners();
  await loadData();
}

function setupEventListeners() {
  const periodBtns = document.querySelectorAll('.period-btn');
  periodBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      periodBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentPeriod = e.target.dataset.period;
      setSkeletons();
      await loadData();
    });
  });

  const badge = document.getElementById('remindersBadge');
  if (badge) {
    badge.addEventListener('click', () => {
      window.location.hash = '#/dueno/recordatorios';
    });
  }

  const btnIA = document.getElementById('btnVerTodasIA');
  if (btnIA) {
    btnIA.addEventListener('click', () => {
      window.location.hash = '#/dueno/ia';
    });
  }
}

function setSkeletons() {
  const ids = ['kpiIngresos', 'kpiLavados', 'kpiTicket', 'kpiRecurrentes'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skeleton-text">&nbsp;</span>';
  });
}

async function loadData() {
  try {
    const lavados = (await db.getAll('lavados')) || [];
    const clientes = (await db.getAll('clientes')) || [];
    const gastos = (await db.getAll('gastos')) || [];
    const servicios = (await db.getAll('servicios')) || [];

    const now = new Date();
    
    // Calcular inicio del período seleccionado
    let startDate = new Date();
    if (currentPeriod === 'hoy') {
      startDate.setHours(0, 0, 0, 0);
    } else if (currentPeriod === 'semana') {
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Lunes como inicio
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
    } else if (currentPeriod === 'mes') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    // Filtrar lavados del periodo (solo completados)
    const lavadosPeriodo = lavados.filter(l => {
      const fechaLavado = new Date(l.fecha);
      return l.estado === 'listo' && fechaLavado >= startDate;
    });
    
    // Calcular KPIs
    const ingresos = lavadosPeriodo.reduce((sum, l) => sum + (Number(l.precioFinal) || 0), 0);
    const cantidadLavados = lavadosPeriodo.length;
    
    // Ticket promedio basado en el periodo activo
    const ticketPromedio = cantidadLavados > 0 ? ingresos / cantidadLavados : 0;

    // Recurrentes vs Nuevos: Porcentaje de clientes con más de 1 lavado histórico
    const clientesConLavados = clientes.filter(c => {
      const lavadosCliente = lavados.filter(l => l.clienteId === c.id && l.estado === 'listo');
      return lavadosCliente.length > 0;
    });
    const recurrentes = clientesConLavados.filter(c => {
      const lavadosCliente = lavados.filter(l => l.clienteId === c.id && l.estado === 'listo');
      return lavadosCliente.length > 1;
    });
    const porcentajeRecurrentes = clientesConLavados.length > 0 ? Math.round((recurrentes.length / clientesConLavados.length) * 100) : 0;

    // Actualizar UI de KPIs
    document.getElementById('kpiIngresos').textContent = formatMoney(ingresos);
    document.getElementById('kpiLavados').textContent = cantidadLavados.toString();
    document.getElementById('kpiTicket').textContent = formatMoney(ticketPromedio);
    document.getElementById('kpiRecurrentes').textContent = `${porcentajeRecurrentes}%`;

    // Recordatorios (30+ días sin lavar)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let recordatoriosCount = 0;
    
    clientes.forEach(c => {
      const lavadosCliente = lavados
        .filter(l => l.clienteId === c.id && l.estado === 'listo')
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
      if (lavadosCliente.length > 0) {
        const lastWash = new Date(lavadosCliente[0].fecha);
        if (lastWash <= thirtyDaysAgo) {
          recordatoriosCount++;
        }
      }
    });
    
    const badgeCount = document.getElementById('remindersCount');
    if (badgeCount) {
      badgeCount.textContent = recordatoriosCount;
      badgeCount.classList.remove('skeleton-text');
    }

    // Gráfico 1: Ingresos vs Costos (Últimos 7 días)
    const days = [];
    const revenueData = [];
    const costsData = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(dayNames[d.getDay()]);
      
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const rev = lavados
        .filter(l => l.estado === 'listo' && new Date(l.fecha) >= dayStart && new Date(l.fecha) <= dayEnd)
        .reduce((sum, l) => sum + (Number(l.precioFinal) || 0), 0);
      
      const cost = gastos
        .filter(g => new Date(g.fecha) >= dayStart && new Date(g.fecha) <= dayEnd)
        .reduce((sum, g) => sum + (Number(g.monto) || 0), 0);

      revenueData.push(rev);
      costsData.push(cost);
    }
    
    const canvasRevCost = document.getElementById('revenueCostsChart');
    if (canvasRevCost) {
      lineChart(canvasRevCost, {
        labels: days,
        datasets: [
          { label: 'Ingresos', data: revenueData, color: '#c9a227' },
          { label: 'Costos', data: costsData, color: 'rgba(255, 99, 132, 0.5)' } // gris/rojo tenue
        ]
      });
    }

    // Gráfico 2: Margen por Servicio
    const serviciosLabels = [];
    const serviciosPrecio = [];
    const serviciosCosto = [];
    
    servicios.forEach(s => {
      serviciosLabels.push(s.nombre);
      serviciosPrecio.push(Number(s.precio) || 0);
      serviciosCosto.push(Number(s.costoDirecto || 0) || (Number(s.precio) * 0.3)); // 30% default si no hay
    });
    
    const canvasMargin = document.getElementById('marginChart');
    if (canvasMargin) {
      barChart(canvasMargin, {
        labels: serviciosLabels,
        datasets: [
          { label: 'Precio Promedio', data: serviciosPrecio, color: '#c9a227' },
          { label: 'Costo Directo', data: serviciosCosto, color: '#f5f0e8' }
        ]
      });
    }

    // Ranking Empleados (Esta semana)
    const startOfWeek = new Date();
    const dayOfWeek = startOfWeek.getDay();
    const diffOfWeek = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startOfWeek.setDate(diffOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const lavadosSemana = lavados.filter(l => l.estado === 'listo' && new Date(l.fecha) >= startOfWeek);
    const empleadosStats = {};
    
    lavadosSemana.forEach(l => {
      const emp = l.empleadoId || 'Desconocido';
      if (!empleadosStats[emp]) {
        empleadosStats[emp] = { lavados: 0, total: 0, nombre: l.empleadoNombre || emp };
      }
      empleadosStats[emp].lavados++;
      empleadosStats[emp].total += (Number(l.precioFinal) || 0);
    });

    const empleadosArr = Object.values(empleadosStats).sort((a, b) => b.lavados - a.lavados);
    const empList = document.getElementById('employeeList');
    if (empList) {
      if (empleadosArr.length === 0) {
        empList.innerHTML = '<li class="empty-state">No hay lavados registrados esta semana.</li>';
      } else {
        empList.innerHTML = empleadosArr.map(e => 
          `<li>
            <strong>${e.nombre}</strong>: ${e.lavados} lavados - ${formatMoney(e.total)}
          </li>`
        ).join('');
      }
    }

    // Recomendaciones IA
    const iaList = document.getElementById('iaList');
    if (iaList) {
      try {
        const recomendaciones = await generarRecomendaciones();
        if (recomendaciones && recomendaciones.length > 0) {
          iaList.innerHTML = recomendaciones.slice(0, 2).map(r => `<li>${r.texto || r}</li>`).join('');
        } else {
          iaList.innerHTML = '<li class="empty-state">Sin recomendaciones por el momento.</li>';
        }
      } catch (err) {
        console.error('Error al generar recomendaciones IA:', err);
        iaList.innerHTML = '<li class="error-state">Error al cargar recomendaciones.</li>';
      }
    }

  } catch (error) {
    console.error('Error al cargar dashboard:', error);
  }
}
