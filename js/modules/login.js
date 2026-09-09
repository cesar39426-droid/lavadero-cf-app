/**
 * js/modules/login.js
 * Módulo de Login / Pantalla de autenticación por PIN
 * LavaderoCF — El esplendor que tu coche merece
 */

import { db } from '../db/db.js';
import { auth } from '../auth.js';
import { toast } from '../app.js';

// ─── Render ────────────────────────────────────────────────────────────────

export async function render(container) {
  container.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">

        <!-- Logo -->
        <div class="auth-logo-wrap">
          <img src="assets/logo.jpg" alt="LavaderoCF" class="auth-logo" />
        </div>

        <!-- Título -->
        <h1 class="auth-title font-serif">LavaderoCF</h1>
        <p class="auth-slogan">El esplendor que tu coche merece</p>

        <div class="divider"></div>

        <!-- Selector de empleado -->
        <div class="auth-section">
          <label class="label" for="empleado-select">¿Quién sos?</label>
          <div class="input-group">
            <select id="empleado-select" class="select" aria-label="Seleccionar empleado">
              <option value="">— Seleccioná tu nombre —</option>
            </select>
          </div>
        </div>

        <!-- Teclado PIN -->
        <div class="auth-section" id="pin-section" style="display:none;">
          <label class="label">PIN de acceso</label>
          
          <!-- Indicadores visuales del PIN -->
          <div class="pin-display" aria-label="PIN ingresado" role="status">
            <span class="pin-dot" data-index="0"></span>
            <span class="pin-dot" data-index="1"></span>
            <span class="pin-dot" data-index="2"></span>
            <span class="pin-dot" data-index="3"></span>
          </div>

          <!-- Teclado numérico -->
          <div class="pin-keyboard" role="group" aria-label="Teclado numérico">
            <button class="pin-key" data-digit="1" aria-label="1">1</button>
            <button class="pin-key" data-digit="2" aria-label="2">2</button>
            <button class="pin-key" data-digit="3" aria-label="3">3</button>
            <button class="pin-key" data-digit="4" aria-label="4">4</button>
            <button class="pin-key" data-digit="5" aria-label="5">5</button>
            <button class="pin-key" data-digit="6" aria-label="6">6</button>
            <button class="pin-key" data-digit="7" aria-label="7">7</button>
            <button class="pin-key" data-digit="8" aria-label="8">8</button>
            <button class="pin-key" data-digit="9" aria-label="9">9</button>
            <button class="pin-key pin-key--clear" id="pin-clear" aria-label="Limpiar">⌫</button>
            <button class="pin-key" data-digit="0" aria-label="0">0</button>
            <button class="pin-key pin-key--enter" id="pin-enter" aria-label="Ingresar" disabled>OK</button>
          </div>
        </div>

        <!-- Botón de acceso público (sin login) -->
        <div class="auth-divider-text"><span>o bien</span></div>
        <a href="#/reserva" class="btn btn-ghost btn-full" id="btn-reserva">
          Ver disponibilidad y reservar turno
        </a>

        <!-- Versión -->
        <p class="auth-version" id="app-version">v1.0.0</p>
      </div>
    </div>
  `;

  await init();
}

// ─── Init ──────────────────────────────────────────────────────────────────

export async function init() {
  await cargarEmpleados();
  configurarPinKeyboard();
  configurarSelectEmpleado();
}

// ─── Estado local del PIN ──────────────────────────────────────────────────

let pinActual = '';
let empleadoSeleccionado = null;

// ─── Cargar empleados activos ──────────────────────────────────────────────

async function cargarEmpleados() {
  const select = document.getElementById('empleado-select');
  if (!select) return;

  try {
    const empleados = await db.getAll('empleados');
    const activos = empleados.filter(e => e.activo);

    activos.forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = emp.nombre + (emp.rol === 'dueno' ? ' 👑' : '');
      select.appendChild(opt);
    });

    // Mostrar versión
    const version = await db.getConfigValue('version');
    const versionEl = document.getElementById('app-version');
    if (versionEl && version) versionEl.textContent = `v${version}`;

  } catch (err) {
    console.error('[Login] Error cargando empleados:', err);
    toast.error('Error al cargar el listado de empleados.');
  }
}

// ─── Selector de empleado ─────────────────────────────────────────────────

function configurarSelectEmpleado() {
  const select = document.getElementById('empleado-select');
  const pinSection = document.getElementById('pin-section');
  if (!select || !pinSection) return;

  select.addEventListener('change', async () => {
    const id = select.value;
    if (!id) {
      pinSection.style.display = 'none';
      empleadoSeleccionado = null;
      resetPin();
      return;
    }

    const empleados = await db.getAll('empleados');
    empleadoSeleccionado = empleados.find(e => e.id === id) || null;

    if (empleadoSeleccionado) {
      pinSection.style.display = 'block';
      pinSection.classList.add('page-enter');
      resetPin();
      // Foco en el teclado para accesibilidad
      document.querySelector('.pin-keyboard')?.focus();
    }
  });
}

// ─── Teclado PIN ──────────────────────────────────────────────────────────

function configurarPinKeyboard() {
  const keyboard = document.querySelector('.pin-keyboard');
  const enterBtn = document.getElementById('pin-enter');
  const clearBtn = document.getElementById('pin-clear');
  if (!keyboard) return;

  // Teclas numéricas
  keyboard.querySelectorAll('.pin-key[data-digit]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (pinActual.length >= 4) return;
      const digit = btn.dataset.digit;
      pinActual += digit;
      actualizarDisplayPin();

      if (pinActual.length === 4) {
        // Auto-submit al completar el PIN
        setTimeout(() => verificarPin(), 150);
      }
    });
  });

  // Borrar último dígito
  clearBtn?.addEventListener('click', () => {
    pinActual = pinActual.slice(0, -1);
    actualizarDisplayPin();
  });

  // Enter manual
  enterBtn?.addEventListener('click', verificarPin);

  // También soporte de teclado físico
  document.addEventListener('keydown', handleKeydown);
}

function handleKeydown(e) {
  // Solo cuando la sección de PIN está visible
  const pinSection = document.getElementById('pin-section');
  if (!pinSection || pinSection.style.display === 'none') return;

  if (e.key >= '0' && e.key <= '9' && pinActual.length < 4) {
    pinActual += e.key;
    actualizarDisplayPin();
    if (pinActual.length === 4) setTimeout(() => verificarPin(), 150);
  } else if (e.key === 'Backspace') {
    pinActual = pinActual.slice(0, -1);
    actualizarDisplayPin();
  } else if (e.key === 'Enter' && pinActual.length === 4) {
    verificarPin();
  }
}

function actualizarDisplayPin() {
  const dots = document.querySelectorAll('.pin-dot');
  const enterBtn = document.getElementById('pin-enter');

  dots.forEach((dot, i) => {
    dot.classList.toggle('pin-dot--filled', i < pinActual.length);
  });

  if (enterBtn) {
    enterBtn.disabled = pinActual.length < 4;
  }
}

function resetPin() {
  pinActual = '';
  actualizarDisplayPin();
}

// ─── Verificar PIN ────────────────────────────────────────────────────────

async function verificarPin() {
  if (!empleadoSeleccionado) return;
  if (pinActual.length !== 4) return;

  const enterBtn = document.getElementById('pin-enter');
  if (enterBtn) enterBtn.disabled = true;

  if (pinActual === empleadoSeleccionado.pin) {
    // ✅ PIN correcto
    auth.setUser(empleadoSeleccionado);

    // Remover listener de teclado
    document.removeEventListener('keydown', handleKeydown);

    // Animación de éxito
    document.querySelector('.pin-display')?.classList.add('pin-display--success');

    await delay(300);

    // Redirigir según rol
    if (empleadoSeleccionado.rol === 'dueno') {
      window.location.hash = '#/dueno/dashboard';
    } else {
      window.location.hash = '#/empleado/registro';
    }
  } else {
    // ❌ PIN incorrecto
    document.querySelector('.pin-display')?.classList.add('pin-display--error');
    toast.error('PIN incorrecto. Intentá de nuevo.');

    await delay(600);
    document.querySelector('.pin-display')?.classList.remove('pin-display--error');
    resetPin();
    if (enterBtn) enterBtn.disabled = false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
