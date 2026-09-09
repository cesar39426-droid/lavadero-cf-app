export function exportToCSV(data, filename) {
    if (!data || !data.length) return;
    
    const BOM = "\uFEFF";
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    // Header
    csvRows.push(headers.map(header => `"${String(header).replace(/"/g, '""')}"`).join(','));
    
    // Rows
    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header];
            const str = (val === null || val === undefined) ? '' : String(val);
            return `"${str.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
    }
    
    const csvContent = BOM + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, filename);
    } else {
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export function parseCSV(text) {
    const rows = [];
    let inQuotes = false;
    let currentRow = [];
    let currentValue = '';
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        if (char === '"') {
            if (inQuotes && text[i + 1] === '"') {
                currentValue += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentValue);
            currentValue = '';
        } else if (char === '\n' && !inQuotes) {
            currentRow.push(currentValue);
            rows.push(currentRow);
            currentRow = [];
            currentValue = '';
        } else if (char !== '\r') {
            currentValue += char;
        }
    }
    
    if (currentRow.length > 0 || currentValue !== '') {
        currentRow.push(currentValue);
        rows.push(currentRow);
    }
    
    const [headers, ...dataRows] = rows;
    
    return dataRows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            if (header) {
                obj[header.trim()] = row[index] !== undefined ? row[index].trim() : '';
            }
        });
        return obj;
    }).filter(obj => Object.keys(obj).length > 0);
}

export function clientesToCSV(clientes, lavados) {
    const data = clientes.map(cliente => {
        const clienteLavados = lavados ? lavados.filter(l => l.clienteId === cliente.id) : [];
        const ultimoLavado = clienteLavados.length ? new Date(Math.max(...clienteLavados.map(l => new Date(l.fecha)))) : null;
        
        return {
            "ID": cliente.id,
            "Nombre": cliente.nombre,
            "Teléfono": cliente.telefono || '',
            "Vehículo": cliente.vehiculo || '',
            "Patente": cliente.patente || '',
            "Total Lavados": clienteLavados.length,
            "Último Lavado": ultimoLavado ? ultimoLavado.toISOString().split('T')[0] : 'Nunca'
        };
    });
    
    exportToCSV(data, `clientes_lavaderocf_${new Date().toISOString().split('T')[0]}.csv`);
}

export function cierreDeCajaToCSV(lavados, empleados, servicios) {
    const data = lavados.map(lavado => {
        const servicio = servicios?.find(s => s.id === lavado.servicioId) || { nombre: 'Desconocido' };
        const empleado = empleados?.find(e => e.id === lavado.empleadoId) || { nombre: 'Desconocido' };
        
        return {
            "Fecha": lavado.fecha.split('T')[0],
            "Servicio": servicio.nombre,
            "Empleado": empleado.nombre,
            "Precio": lavado.precio || 0,
            "Método de Pago": lavado.metodoPago || 'Efectivo',
            "Estado": lavado.estado || 'Completado'
        };
    });
    
    exportToCSV(data, `cierre_caja_${new Date().toISOString().split('T')[0]}.csv`);
}

export function importClientesFromCSV(csvText) {
    const rawData = parseCSV(csvText);
    const validClientes = [];
    
    for (const row of rawData) {
        if (row["Nombre"]) {
            validClientes.push({
                nombre: row["Nombre"],
                telefono: row["Teléfono"] || '',
                vehiculo: row["Vehículo"] || '',
                patente: row["Patente"] || ''
            });
        }
    }
    
    return validClientes;
}
