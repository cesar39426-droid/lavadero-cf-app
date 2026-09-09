export function formatMoney(amount) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(amount);
}

export function formatDate(isoString) {
    return new Intl.DateTimeFormat('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(new Date(isoString));
}

export function formatDateShort(isoString) {
    return new Intl.DateTimeFormat('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(isoString));
}

export function formatTime(isoString) {
    return new Intl.DateTimeFormat('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(isoString));
}

export function formatDateTime(isoString) {
    return new Intl.DateTimeFormat('es-AR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(isoString));
}

export function formatRelativeDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return "Hoy";
    if (diff === 1) return "Ayer";
    if (diff === -1) return "Mañana";
    if (diff > 1) return `Hace ${diff} días`;
    if (diff < -1) return `En ${Math.abs(diff)} días`;
    
    return formatDateShort(isoString);
}

export function daysSince(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}

export function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    let result = [];
    if (hours > 0) result.push(`${hours} hora${hours > 1 ? 's' : ''}`);
    if (mins > 0) result.push(`${mins} min`);
    
    return result.join(' ') || '0 min';
}

export function getTimeSlots(startHour, endHour, stepMin = 60) {
    const slots = [];
    let currentHour = startHour;
    let currentMin = 0;
    
    while (currentHour < endHour || (currentHour === endHour && currentMin === 0)) {
        const hourStr = currentHour.toString().padStart(2, '0');
        const minStr = currentMin.toString().padStart(2, '0');
        slots.push(`${hourStr}:${minStr}`);
        
        currentMin += stepMin;
        if (currentMin >= 60) {
            currentHour += Math.floor(currentMin / 60);
            currentMin = currentMin % 60;
        }
    }
    
    return slots;
}

export function isSunday(dateString) {
    return new Date(dateString).getDay() === 0; // 0 = Sunday
}

export function getNextAvailableDays(count = 4) {
    const days = [];
    let current = new Date();
    
    while (days.length < count) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, '0');
        const dd = String(current.getDate()).padStart(2, '0');
        
        days.push(`${yyyy}-${mm}-${dd}`);
        
        // Next day
        current.setDate(current.getDate() + 1);
    }
    
    return days;
}
