function topOvertimeEmployees(employeeRows = [], topN = 3) {
  return [...employeeRows]
    .filter((row) => Number(row.overtimeHours || 0) > 0)
    .sort((a, b) => Number(b.overtimeHours || 0) - Number(a.overtimeHours || 0))
    .slice(0, topN);
}

export function buildProactiveWarnings({ stats, conflicts = [] }) {
  const warnings = [];
  const rows = stats?.employees || [];
  const summary = stats?.summary || {};

  if (Number(summary.conflictCritical || 0) > 0) {
    warnings.push({
      priority: 'critical',
      title: 'Kritikus hiba publikacio elott',
      text: `${summary.conflictCritical} kritikus konfliktus van a tervben, ezt publikalas elott javitani kell.`,
      type: 'critical_conflict',
    });
  }

  if (Number(summary.totalOvertimeHours || 0) > 0) {
    const top = topOvertimeEmployees(rows, 3);
    const topText = top.length
      ? `Leginkabb erintett: ${top.map((item) => `${item.name} (${item.overtimeHours}h)`).join(', ')}.`
      : '';

    warnings.push({
      priority: 'high',
      title: 'Tulora-kockazat',
      text: `A becsult osszes tulora ${summary.totalOvertimeHours} ora. ${topText}`.trim(),
      type: 'overtime_risk',
    });
  }

  const pharmacistGaps = conflicts.filter((item) => item.code === 'missing_pharmacist').length;
  if (pharmacistGaps > 0) {
    warnings.push({
      priority: 'high',
      title: 'Gyogyszeresz hiany varhato',
      text: `${pharmacistGaps} muszakban nincs meg a minimum gyogyszeresz lefedettseg.`,
      type: 'pharmacist_gap',
    });
  }

  const weekendCounts = rows.map((row) => Number(row.weekendShifts || 0));
  if (weekendCounts.length > 1) {
    const max = Math.max(...weekendCounts);
    const min = Math.min(...weekendCounts);
    if (max - min >= 3) {
      warnings.push({
        priority: 'medium',
        title: 'Hetvegi elosztas egyenetlen',
        text: `A hetvegi terheles kulonbsege magas (max ${max}, min ${min}). Erdemes fairness ujratervezest futtatni.`,
        type: 'weekend_imbalance',
      });
    }
  }

  if (warnings.length === 0) {
    warnings.push({
      priority: 'info',
      title: 'Stabil terv',
      text: 'Jelenleg nem latszik kritikus kockazat. A terv megfeleloen kiegyensulyozott.',
      type: 'stable_plan',
    });
  }

  return warnings;
}
