function normalizarTelefono(telefono) {
    if (!telefono) return '';
    let num = telefono.replace(/\D/g, ''); // Quitar todo lo no numérico
    
    // Si empieza con 0 o 15, limpiarlo (formato viejo arg)
    if (num.startsWith('0')) num = num.substring(1);
    if (num.startsWith('15') && num.length === 12) num = num.substring(2);
    
    // Asegurar que tenga código de país
    if (!num.startsWith('549') && !num.startsWith('54')) {
        num = '549' + num;
    } else if (num.startsWith('54') && !num.startsWith('549')) {
        num = '549' + num.substring(2);
    }
    return num;
}

export function openWhatsApp(telefono, mensaje) {
    const numeroNormalizado = normalizarTelefono(telefono);
    if (!numeroNormalizado) {
        console.error('Número de teléfono inválido');
        return;
    }
    const url = `https://wa.me/${numeroNormalizado}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

export function whatsappListo(nombre, telefono) {
    const mensaje = `¡Hola ${nombre}! Tu vehículo ya está listo para retirar en LavaderoCF. ¡Te esperamos! 🚗✨`;
    openWhatsApp(telefono, mensaje);
}

export function whatsappRecordatorio(nombre, telefono) {
    const mensaje = `¡Hola ${nombre}! Ya pasaron 30 días desde tu último lavado en LavaderoCF. ¿Querés agendar un nuevo turno de mantenimiento? Respondé este mensaje y coordinamos. ✨`;
    openWhatsApp(telefono, mensaje);
}

export function whatsappConfirmacionTurno(nombre, telefono, servicio, fecha, hora) {
    const mensaje = `¡Hola ${nombre}! Confirmamos tu turno para el servicio de ${servicio} el ${fecha} a las ${hora}hs en LavaderoCF. ¡Te esperamos! 🚗`;
    openWhatsApp(telefono, mensaje);
}
