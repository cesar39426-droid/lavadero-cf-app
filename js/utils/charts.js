const THEME = {
    bg: '#000000',
    grid: 'rgba(201, 162, 39, 0.15)',
    text: '#f5f0e8',
    primary: '#c9a227'
};

function drawAxis(ctx, width, height, maxVal, formatY) {
    ctx.strokeStyle = THEME.grid;
    ctx.fillStyle = THEME.text;
    ctx.lineWidth = 1;
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const paddingX = 60;
    const paddingY = 40;
    const steps = 5;

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
        const y = height - paddingY - (i * (height - paddingY * 2) / steps);
        const val = (i * maxVal / steps);
        
        ctx.moveTo(paddingX, y);
        ctx.lineTo(width - 20, y);
        ctx.fillText(formatY ? formatY(val) : val.toFixed(0), paddingX - 10, y);
    }
    ctx.stroke();
    
    // Eje X baseline
    ctx.beginPath();
    ctx.moveTo(paddingX, height - paddingY);
    ctx.lineTo(width - 20, height - paddingY);
    ctx.strokeStyle = THEME.text;
    ctx.stroke();
}

export function barChart(canvas, { labels, datasets, title, formatY }) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Título
    ctx.fillStyle = THEME.text;
    ctx.font = 'bold 16px Playfair Display, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title || '', width / 2, 10);
    
    const data = datasets[0].data;
    const maxVal = Math.max(...data, 1);
    
    drawAxis(ctx, width, height, maxVal, formatY);
    
    const paddingX = 60;
    const paddingY = 40;
    const chartWidth = width - paddingX - 20;
    const chartHeight = height - paddingY * 2;
    
    const barWidth = (chartWidth / Math.max(labels.length, 1)) * 0.6;
    const spacing = (chartWidth / Math.max(labels.length, 1));
    
    ctx.fillStyle = THEME.primary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '12px Inter, sans-serif';
    
    labels.forEach((label, i) => {
        const val = data[i] || 0;
        const barHeight = (val / maxVal) * chartHeight;
        const x = paddingX + (i * spacing) + (spacing - barWidth) / 2;
        const y = height - paddingY - barHeight;
        
        // Bar
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Label
        ctx.fillStyle = THEME.text;
        ctx.fillText(label, x + barWidth / 2, height - paddingY + 10);
        ctx.fillStyle = THEME.primary; // reset for next bar
    });
}

export function lineChart(canvas, { labels, datasets, title, formatY }) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = THEME.text;
    ctx.font = 'bold 16px Playfair Display, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title || '', width / 2, 10);
    
    const data = datasets[0].data;
    const maxVal = Math.max(...data, 1);
    
    drawAxis(ctx, width, height, maxVal, formatY);
    
    const paddingX = 60;
    const paddingY = 40;
    const chartWidth = width - paddingX - 20;
    const chartHeight = height - paddingY * 2;
    
    const spacing = chartWidth / Math.max(labels.length - 1, 1);
    
    ctx.strokeStyle = THEME.primary;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    
    labels.forEach((label, i) => {
        const val = data[i] || 0;
        const pointHeight = (val / maxVal) * chartHeight;
        const x = paddingX + (i * spacing);
        const y = height - paddingY - pointHeight;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        
        // Labels
        ctx.fillStyle = THEME.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(label, x, height - paddingY + 10);
    });
    
    ctx.stroke();
    
    // Draw points
    ctx.fillStyle = THEME.bg;
    labels.forEach((label, i) => {
        const val = data[i] || 0;
        const pointHeight = (val / maxVal) * chartHeight;
        const x = paddingX + (i * spacing);
        const y = height - paddingY - pointHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });
}

export function drawResponsiveChart(canvasId, chartFn, args) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    const render = () => {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height || 300; 
        chartFn(canvas, args);
    };
    
    render();
    
    const observer = new ResizeObserver(() => {
        requestAnimationFrame(render);
    });
    
    observer.observe(canvas.parentElement);
    
    return () => observer.disconnect();
}
