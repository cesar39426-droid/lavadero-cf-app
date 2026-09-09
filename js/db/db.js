import { DB_NAME, DB_VERSION, STORES } from './schema.js';
import { seedDatabase } from './seeds.js';

class DB {
  constructor() {
    this.db = null;
  }

  // Inicialización
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        for (const storeName in STORES) {
          if (!db.objectStoreNames.contains(storeName)) {
            const config = STORES[storeName];
            const store = db.createObjectStore(storeName, { keyPath: config.keyPath });
            
            if (config.indexes) {
              config.indexes.forEach(index => {
                store.createIndex(index.name, index.name, { unique: index.unique });
              });
            }
          }
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        try {
          // Llama a seeds si es necesario (es idempotente)
          await seedDatabase(this);
          resolve(this);
        } catch (error) {
          reject(error);
        }
      };

      request.onerror = (event) => {
        console.error('Error abriendo IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  _transaction(storeName, mode) {
    if (!this.db) throw new Error('Base de datos no inicializada');
    const tx = this.db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    return { tx, store };
  }

  // CRUD genérico
  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      try {
        const { store } = this._transaction(storeName, 'readonly');
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      try {
        const { store } = this._transaction(storeName, 'readonly');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async getAllByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      try {
        const { store } = this._transaction(storeName, 'readonly');
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async put(storeName, record) {
    return new Promise((resolve, reject) => {
      try {
        // Autogenerar UUID si el store usa id y no viene provisto
        if (!record.id && STORES[storeName] && STORES[storeName].keyPath === 'id') {
          record.id = crypto.randomUUID();
        }
        const { store, tx } = this._transaction(storeName, 'readwrite');
        store.put(record);
        tx.oncomplete = () => resolve(record);
        tx.onerror = () => reject(tx.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      try {
        const { store, tx } = this._transaction(storeName, 'readwrite');
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      try {
        const { store, tx } = this._transaction(storeName, 'readwrite');
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async count(storeName) {
    return new Promise((resolve, reject) => {
      try {
        const { store } = this._transaction(storeName, 'readonly');
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Queries especiales
  async getClienteByTelefono(telefono) {
    try {
      const clientes = await this.getAllByIndex('clientes', 'telefono', telefono);
      return clientes.length > 0 ? clientes[0] : null;
    } catch (error) {
      console.error('Error buscando cliente por teléfono:', error);
      return null;
    }
  }

  async getClienteByPatente(patente) {
    try {
      const clientes = await this.getAll('clientes');
      const lowerPatente = patente.toLowerCase();
      // Buscamos si alguna patente del cliente incluye la solicitada
      return clientes.find(c => 
        c.patentes && c.patentes.some(p => p.toLowerCase().includes(lowerPatente))
      ) || null;
    } catch (error) {
      console.error('Error buscando cliente por patente:', error);
      return null;
    }
  }

  async getLavadosByCliente(clienteId) {
    try {
      return await this.getAllByIndex('lavados', 'clienteId', clienteId);
    } catch (error) {
      console.error('Error buscando lavados por cliente:', error);
      return [];
    }
  }

  async getLavadosDelDia(fecha) {
    try {
      const lavados = await this.getAll('lavados');
      return lavados.filter(l => l.fechaInicio && l.fechaInicio.startsWith(fecha));
    } catch (error) {
      console.error('Error buscando lavados del día:', error);
      return [];
    }
  }

  async getLavadosByRango(fechaInicio, fechaFin) {
    try {
      const lavados = await this.getAll('lavados');
      return lavados.filter(l => {
        if (!l.fechaInicio) return false;
        return l.fechaInicio >= fechaInicio && l.fechaInicio <= fechaFin;
      });
    } catch (error) {
      console.error('Error buscando lavados por rango de fechas:', error);
      return [];
    }
  }

  async getTurnosByFecha(fecha) {
    try {
      const turnos = await this.getAll('turnos');
      return turnos.filter(t => t.fecha && t.fecha.startsWith(fecha));
    } catch (error) {
      console.error('Error buscando turnos por fecha:', error);
      return [];
    }
  }

  async getConfigValue(key) {
    try {
      const record = await this.get('config', key);
      return record ? record.value : null;
    } catch (error) {
      console.error(`Error obteniendo config ${key}:`, error);
      return null;
    }
  }

  async setConfigValue(key, value) {
    try {
      return await this.put('config', { key, value });
    } catch (error) {
      console.error(`Error guardando config ${key}:`, error);
      throw error;
    }
  }

  // Backup y restauración
  async exportAllData() {
    try {
      const data = {};
      for (const storeName of Object.keys(STORES)) {
        data[storeName] = await this.getAll(storeName);
      }
      return data;
    } catch (error) {
      console.error('Error exportando datos:', error);
      throw error;
    }
  }

  async importAllData(data) {
    try {
      for (const storeName of Object.keys(STORES)) {
        if (data[storeName] && Array.isArray(data[storeName])) {
          await this.clear(storeName);
          for (const record of data[storeName]) {
            await this.put(storeName, record);
          }
        }
      }
      return true;
    } catch (error) {
      console.error('Error importando datos:', error);
      throw error;
    }
  }
}

// Instancia singleton
export const db = new DB();
