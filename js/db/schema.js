export const DB_NAME = 'lavaderocf';
export const DB_VERSION = 1;

export const STORES = {
  clientes: { keyPath: 'id', indexes: [
    { name: 'telefono', unique: true },
    { name: 'nombre', unique: false }
  ]},
  servicios: { keyPath: 'id' },
  empleados: { keyPath: 'id', indexes: [
    { name: 'pin', unique: false } // No unique porque podrían coincidir pero se valida en app
  ]},
  lavados: { keyPath: 'id', indexes: [
    { name: 'clienteId', unique: false },
    { name: 'estado', unique: false },
    { name: 'fechaInicio', unique: false },
    { name: 'empleadoId', unique: false }
  ]},
  turnos: { keyPath: 'id', indexes: [
    { name: 'fecha', unique: false },
    { name: 'estado', unique: false }
  ]},
  costos: { keyPath: 'id', indexes: [
    { name: 'fecha', unique: false }
  ]},
  config: { keyPath: 'key' }
};
