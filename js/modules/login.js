/**
 * js/modules/login.js
 * Pantalla de login con PIN táctil
 */

import { db }   from '../db/db.js';
import { auth } from '../auth.js';
import { toast } from '../utils/toast.js';

// Estado del módulo
let pinActual = '';
let empleadoSeleccionado = null;

// ─── Render ────────────────────────────────────────────────────────────────

export async function render(container) {
  container.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">

        <div class="auth-logo-wrap">
          <img src="assets/logo.jpg" alt="LavaderoCF" class="auth-logo" />
        </div>

        <h1 class="auth-title font-serif">LavaderoCF</h1>
        <p class="auth-slogan">El esplendor que tu coche merece</p>

        <div class="divider"></div>

        <div class="auth-section">
          <label class="label" for="empleado-select">¿Quién sos?</label>
          <select id="empleado-select" class="select">
            <option value="">— Seleccioná tu nombre —</option>
          </select>
        </div>

        <div class="auth-section" id="pin-section" style="display:none;">
          <label class="label">PIN de acceso</label>

          <div class="pin-display" id="pin-display">
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
          </div>

          <div class="pin-keyboard">
            <button class="pin-key" data-digit="1">1</button>
            <button class="pin-key" data-digit="2">2</button>
            <button class="pin-key" data-digit="3">3</button>
            <button class="pin-key" data-digit="4">4</button>
            <button class="pin-key" data-digit="5">5</button>
            <button class="pin-key" data-digit="6">6</button>
            <button class="pin-key" data-digit="7">7</button>
            <button class="pin-key" data-digit="8">8</button>
            <button class="pin-key" data-digit="9">9</button>
            <button class="pin-key pin-key--clear" id="pin-clear">⌫</button>
            <button class="pin-key" data-digit="0">0</button>
            <button class="pin-key pin-key--enter" id="pin-enter" disabled>OK</button>
          </div>
        </div>

        <div class="auth-divider-text"><span>o bien</span></div>
        <a href="#/reserva" class="btn btn-ghost btn-full">
          Ver disponibilidad y reservar turno
        </a>

        <p class="auth-version" id="app-version">v1.0.0</p>
      </div>
    </div>
  `;
}


// ─── Init ──────────────────────────────────────────────────────────────────

export async function init() {
  // Reset estado
  pinActual = '';
  empleadoSeleccionado = null;

  await cargarEmpleados();
  configurarSelectEmpleado();
  configurarPinKeyboard();
}

// ─── Cargar empleados ──────────────────────────────────────────────────────

async function cargarEmpleados() {
  const select = document.getElementById('empleado-select');
  if (!select) return;

  try {
    const todos = await db.getAll('empleados');
    const activos = todos.filter(e => e.activo);

    activos.forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = emp.nombre + (emp.rol === 'dueno' ? ' 👑' : '');
      select.appendChild(opt);
    });

    // Versión
    const ver = await db.getConfigValue('version');
    const verEl = document.getElementById('app-version');
    if (verEl && ver) verEl.textContent = `v${ver}`;

  } catch (err) {
    console.error('[Login] Error cargando empleados:', err);
  }
}

// ─── Selector de empleado ──────────────────────────────────────────────────

function configurarSelectEmpleado() {
  const select = document.getElementById('empleado-select');
  if (!select) return;

  select.addEventListener('change', async () => {
    const pinSection = document.getElementById('pin-section');
    const id = select.value;

    if (!id) {
      if (pinSection) pinSection.style.display = 'none';
      empleadoSeleccionado = null;
      resetPin();
      return;
    }

    try {
      const todos = await db.getAll('empleados');
      empleadoSeleccionado = todos.find(e => e.id === id) || null;

      if (empleadoSeleccionado && pinSection) {
        pinSection.style.display = 'block';
        resetPin();
      }
    } catch (err) {
      console.error('[Login] Error buscando empleado:', err);
    }
  });
}

// ─── Teclado PIN ──────────────────────────────────────────────────────────

function configurarPinKeyboard() {
  const keyboard = document.querySelector('.pin-keyboard');
  if (!keyboard) return;

  keyboard.addEventListener('click', e => {
    const btn = e.target.closest('.pin-key');
    if (!btn) return;

    if (btn.dataset.digit !== undefined) {
      if (pinActual.length < 4) {
        pinActual += btn.dataset.digit;
        actualizarDisplayPin();
        if (pinActual.length === 4) {
          setTimeout(verificarPin, 120);
        }
      }
    } else if (btn.id === 'pin-clear') {
      pinActual = pinActual.slice(0, -1);
      actualizarDisplayPin();
    } else if (btn.id === 'pin-enter') {
      verificarPin();
    }
  });

  // Teclado físico
  document.addEventListener('keydown', handleKeydown);
}

function handleKeydown(e) {
  const pinSection = document.getElementById('pin-section');
  if (!pinSection || pinSection.style.display === 'none') return;

  if (e.key >= '0' && e.key <= '9' && pinActual.length < 4) {
    pinActual += e.key;
    actualizarDisplayPin();
    if (pinActual.length === 4) setTimeout(verificarPin, 120);
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

  if (enterBtn) enterBtn.disabled = pinActual.length < 4;
}

function resetPin() {
  pinActual = '';
  actualizarDisplayPin();
}

// ─── Verificar PIN ────────────────────────────────────────────────────────

async function verificarPin() {
  if (!empleadoSeleccionado || pinActual.length !== 4) return;

  if (pinActual === empleadoSeleccionado.pin) {
    auth.setUser(empleadoSeleccionado);
    document.removeEventListener('keydown', handleKeydown);
    toast.success('¡Bienvenido, ' + empleadoSeleccionado.nombre + '!');

    await new Promise(r => setTimeout(r, 300));

    if (empleadoSeleccionado.rol === 'dueno') {
      window.location.hash = '#/dueno/dashboard';
    } else {
      window.location.hash = '#/empleado/registro';
    }
  } else {
    toast.error('PIN incorrecto. Intentá de nuevo.');
    resetPin();
  }
}
