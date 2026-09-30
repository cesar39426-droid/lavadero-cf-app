/**
 * Catálogo local de vehículos frecuentes en Argentina y la región.
 * La categoría determina la tarifa de Lavado Estándar y Premium.
 */

export const VEHICLE_CATEGORIES = Object.freeze({
    AUTO: 'auto',
    FAMILIAR: 'familiar',
    SUV: 'suv'
});

export const VEHICLE_CATEGORY_META = Object.freeze({
    [VEHICLE_CATEGORIES.AUTO]: {
        label: 'Auto / Sedán / Hatchback',
        shortLabel: 'Auto',
        icon: '🚗',
        legacyType: 'Auto'
    },
    [VEHICLE_CATEGORIES.FAMILIAR]: {
        label: 'Familiar chico / Rural',
        shortLabel: 'Familiar chico',
        icon: '🚙',
        legacyType: 'Camioneta-Familiar'
    },
    [VEHICLE_CATEGORIES.SUV]: {
        label: 'SUV / Crossover / Pick-up / 4x4',
        shortLabel: 'SUV / Pick-up / 4x4',
        icon: '🛻',
        legacyType: '4x4'
    }
});

export const VEHICLE_PRICES = Object.freeze({
    standard: Object.freeze({
        [VEHICLE_CATEGORIES.AUTO]: 30000,
        [VEHICLE_CATEGORIES.FAMILIAR]: 35000,
        [VEHICLE_CATEGORIES.SUV]: 40000
    }),
    premium: Object.freeze({
        [VEHICLE_CATEGORIES.AUTO]: 80000,
        [VEHICLE_CATEGORIES.FAMILIAR]: 95000,
        [VEHICLE_CATEGORIES.SUV]: 110000
    })
});

const VEHICLES = [
    ['Chevrolet', 'Agile', 'auto'], ['Chevrolet', 'Celta', 'auto'], ['Chevrolet', 'Classic', 'auto'],
    ['Chevrolet', 'Onix', 'auto'], ['Chevrolet', 'Prisma', 'auto'], ['Chevrolet', 'Cruze', 'auto'],
    ['Chevrolet', 'Tracker', 'suv'], ['Chevrolet', 'Spin', 'familiar'], ['Chevrolet', 'S10', 'suv'],
    ['Fiat', 'Argo', 'auto'], ['Fiat', 'Cronos', 'auto'], ['Fiat', 'Palio', 'auto'],
    ['Fiat', 'Palio Weekend', 'familiar'], ['Fiat', 'Siena', 'auto'], ['Fiat', 'Punto', 'auto'],
    ['Fiat', 'Strada', 'suv'], ['Fiat', 'Toro', 'suv'], ['Fiat', 'Fiorino', 'familiar'],
    ['Ford', 'Ka', 'auto'], ['Ford', 'Fiesta', 'auto'], ['Ford', 'Focus', 'auto'],
    ['Ford', 'EcoSport', 'suv'], ['Ford', 'Ranger', 'suv'], ['Ford', 'Maverick', 'suv'],
    ['Honda', 'Fit', 'auto'], ['Honda', 'City', 'auto'], ['Honda', 'Civic', 'auto'],
    ['Honda', 'HR-V', 'suv'], ['Honda', 'CR-V', 'suv'],
    ['Nissan', 'March', 'auto'], ['Nissan', 'Versa', 'auto'], ['Nissan', 'Kicks', 'suv'],
    ['Nissan', 'X-Trail', 'suv'], ['Nissan', 'Frontier', 'suv'],
    ['Peugeot', '208', 'auto'], ['Peugeot', '207', 'auto'], ['Peugeot', '308', 'auto'],
    ['Peugeot', '408', 'auto'], ['Peugeot', '2008', 'suv'], ['Peugeot', '3008', 'suv'],
    ['Renault', 'Clio', 'auto'], ['Renault', 'Sandero', 'auto'], ['Renault', 'Logan', 'auto'],
    ['Renault', 'Stepway', 'auto'], ['Renault', 'Fluence', 'auto'], ['Renault', 'Duster', 'suv'],
    ['Renault', 'Captur', 'suv'], ['Renault', 'Oroch', 'suv'],
    ['Toyota', 'Etios', 'auto'], ['Toyota', 'Yaris', 'auto'], ['Toyota', 'Corolla', 'auto'],
    ['Toyota', 'Prius', 'auto'], ['Toyota', 'Corolla Cross', 'suv'], ['Toyota', 'SW4', 'suv'],
    ['Toyota', 'Hilux', 'suv'], ['Toyota', 'RAV4', 'suv'],
    ['Volkswagen', 'Gol', 'auto'], ['Volkswagen', 'Polo', 'auto'], ['Volkswagen', 'Golf', 'auto'],
    ['Volkswagen', 'Virtus', 'auto'], ['Volkswagen', 'Vento', 'auto'], ['Volkswagen', 'Suran', 'familiar'],
    ['Volkswagen', 'Golf Variant', 'familiar'], ['Volkswagen', 'T-Cross', 'suv'],
    ['Volkswagen', 'Taos', 'suv'], ['Volkswagen', 'Nivus', 'suv'], ['Volkswagen', 'Amarok', 'suv'],
    ['Citroën', 'C3', 'auto'], ['Citroën', 'C4', 'auto'], ['Citroën', 'C-Elysée', 'auto'],
    ['Citroën', 'Berlingo', 'familiar'], ['Citroën', 'C4 Cactus', 'suv'],
    ['Jeep', 'Renegade', 'suv'], ['Jeep', 'Compass', 'suv'], ['Jeep', 'Cherokee', 'suv'],
    ['Mercedes-Benz', 'Clase A', 'auto'], ['Mercedes-Benz', 'Clase C', 'auto'],
    ['Mercedes-Benz', 'GLA', 'suv'], ['BMW', 'Serie 1', 'auto'], ['BMW', 'X1', 'suv'],
    ['Audi', 'A3', 'auto'], ['Audi', 'Q3', 'suv']
].map(([marca, modelo, categoria]) => ({
    id: `${normalizeText(marca)}-${normalizeText(modelo)}`,
    marca,
    modelo,
    categoria,
    aliases: [normalizeText(`${marca} ${modelo}`), normalizeText(modelo)]
}));

function normalizeText(value = '') {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ');
}

export function searchVehicles(query, limit = 8) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return [];

    return VEHICLES
        .map(vehicle => {
            const exact = vehicle.aliases.some(alias => alias === normalizedQuery);
            const starts = vehicle.aliases.some(alias => alias.startsWith(normalizedQuery));
            const includes = vehicle.aliases.some(alias => alias.includes(normalizedQuery));
            return { vehicle, score: exact ? 3 : (starts ? 2 : (includes ? 1 : 0)) };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || a.vehicle.marca.localeCompare(b.vehicle.marca))
        .slice(0, limit)
        .map(item => item.vehicle);
}

export function getVehicleById(id) {
    return VEHICLES.find(vehicle => vehicle.id === id) || null;
}

export function getVehicleCategoryMeta(category) {
    return VEHICLE_CATEGORY_META[category] || VEHICLE_CATEGORY_META[VEHICLE_CATEGORIES.AUTO];
}

export function getServicePrice(service, category) {
    const serviceName = normalizeText(service?.nombre);
    const isPremium = serviceName.includes('premium');
    const isStandard = serviceName.includes('estandar') || serviceName.includes('basico') || serviceName.includes('completo');

    if (category && (isPremium || isStandard)) {
        return VEHICLE_PRICES[isPremium ? 'premium' : 'standard'][category];
    }

    const categoryPriceKey = {
        [VEHICLE_CATEGORIES.AUTO]: 'precioAuto',
        [VEHICLE_CATEGORIES.FAMILIAR]: 'precioCamioneta',
        [VEHICLE_CATEGORIES.SUV]: 'precio4x4'
    }[category];

    return Number(service?.[categoryPriceKey] ?? service?.precio ?? 0);
}

export function legacyTypeForCategory(category) {
    return getVehicleCategoryMeta(category).legacyType;
}

export function categoryFromLegacyType(type) {
    if (type === 'Camioneta-Familiar') return VEHICLE_CATEGORIES.FAMILIAR;
    if (type === '4x4' || type === 'SUV') return VEHICLE_CATEGORIES.SUV;
    return VEHICLE_CATEGORIES.AUTO;
}

export function formatVehicleName(vehicle) {
    return vehicle ? `${vehicle.marca} ${vehicle.modelo}` : 'Selección manual';
}
