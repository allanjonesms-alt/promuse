export function safeFormatDate(dateVal?: string | number | Date | null): string {
  if (!dateVal) return 'N/A';
  try {
    if (typeof dateVal === 'string') {
      const clean = dateVal.trim();
      // Handle YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        const [year, month, day] = clean.split('-');
        return `${day}/${month}/${year}`;
      }
      // Handle YYYY-MM-DDTHH:mm... or ISO
      if (clean.includes('T')) {
        const datePart = clean.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          const [year, month, day] = datePart.split('-');
          return `${day}/${month}/${year}`;
        }
      }
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) {
      return typeof dateVal === 'string' ? dateVal : 'N/A';
    }
    return d.toLocaleDateString('pt-BR');
  } catch {
    return typeof dateVal === 'string' ? dateVal : 'N/A';
  }
}

export function safeFormatTime(dateVal?: string | number | Date | null): string {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'N/A';
  }
}

export function safeFormatDateTime(dateVal?: string | number | Date | null): string {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) {
      return typeof dateVal === 'string' ? dateVal : 'N/A';
    }
    return d.toLocaleString('pt-BR');
  } catch {
    return typeof dateVal === 'string' ? dateVal : 'N/A';
  }
}
