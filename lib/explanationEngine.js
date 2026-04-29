function formatHours(hours) {
  return `${Number(hours || 0).toFixed(1)} ora`;
}

export function explainAssignmentDecision({
  assignmentReasons = [],
  employeeName,
  date,
  shift,
}) {
  const reasons = (assignmentReasons || []).filter((item) => {
    if (employeeName && item.employeeName !== employeeName) return false;
    if (date && item.date !== date) return false;
    if (shift && item.shift !== shift) return false;
    return true;
  });

  if (reasons.length === 0) {
    return {
      title: 'Nem talaltam konkret kiosztasi indoklast ehhez a muszakhoz.',
      bullets: [
        'Lehet, hogy ez a muszak meg kezileg lett rogzitve.',
        'Lehet, hogy egy korabbi tervbol maradt bent.',
        'Kerd ujrageneralast, hogy friss dontesi indoklast kapj.',
      ],
    };
  }

  const top = reasons[0];
  const base = top.reason || 'A szabalyoknak legjobban megfelelo jelolt lett valasztva.';

  return {
    title: `${top.employeeName} ezt a muszakot kapta: ${top.date} ${top.shift}`,
    bullets: [
      'A muszakra tenylegesen szabad es elerheto volt.',
      'A pihenoido es a munkaido-korlatok teljesultek.',
      'A kivalsztasnal terheles es preferencia pontszam is szamitott.',
      base,
    ],
  };
}

export function humanizeConflicts(conflicts = []) {
  return conflicts.slice(0, 6).map((item) => {
    if (item.code === 'weekly_hours_limit') {
      return `${item.employeeName || 'Egy dolgozo'} ezen a heten tullepne a heti orakeretet.`;
    }
    if (item.code === 'monthly_hours_limit') {
      return `${item.employeeName || 'Egy dolgozo'} havi orakerete tullepes kozeleben van.`;
    }
    if (item.code === 'missing_pharmacist') {
      return `${item.date || 'Egy napon'} gyogyszereszhiany varhato a jelenlegi tervben.`;
    }
    if (item.code === 'min_staff') {
      return `${item.date || 'Egy napon'} letszamhiany varhato a muszakban.`;
    }
    if (item.code === 'legal_rest_time') {
      return `${item.employeeName || 'Egy dolgozo'} pihenoideje nem erne el a minimumot.`;
    }
    return item.message || 'Van egy javitando konfliktus a tervben.';
  });
}

export function buildHumanPlanSummary({ stats, conflicts = [] }) {
  const summary = stats?.summary || {};
  const critical = Number(summary.conflictCritical || 0);
  const warning = Number(summary.conflictWarning || 0);
  const overtime = Number(summary.totalOvertimeHours || 0);

  if (critical === 0 && warning === 0 && overtime === 0) {
    return 'A terv stabil: nincs kritikus konfliktus, es nem latszik tulora-kockazat.';
  }

  const parts = [];
  if (critical > 0) parts.push(`${critical} kritikus konfliktus`);
  if (warning > 0) parts.push(`${warning} figyelmeztetes`);
  if (overtime > 0) parts.push(`${formatHours(overtime)} osszesitett tulora`);

  return `A terv jelenleg: ${parts.join(', ')}. Erdemes publikacio elott javitani.`;
}
