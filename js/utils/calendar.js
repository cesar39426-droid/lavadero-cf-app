export function downloadICS(evento) {
    const { title, description, startDate, startTime, durationMinutes, location } = evento;
    
    // Format YYYYMMDDTHHMMSSZ
    const formatDate = (dateStr, timeStr) => {
        const d = new Date(`${dateStr}T${timeStr}:00`);
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const start = formatDate(startDate, startTime);
    
    // Calculate end time
    const endDate = new Date(`${startDate}T${startTime}:00`);
    endDate.setMinutes(endDate.getMinutes() + (durationMinutes || 60));
    const end = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//LavaderoCF//Turnos//ES',
        'BEGIN:VEVENT',
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${title || 'Turno en LavaderoCF'}`,
        `DESCRIPTION:${description || ''}`,
        `LOCATION:${location || 'LavaderoCF'}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'turno_lavaderocf.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
