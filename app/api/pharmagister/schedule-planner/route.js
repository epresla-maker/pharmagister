import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { requireSchedulePharmacyAccess } from '@/lib/scheduleAccess';
import {
  buildPlannerSuggestions,
  computePlannerStats,
  detectScheduleConflicts,
  generateAutoSchedulePlan,
  quickReplanForAbsence,
} from '@/lib/scheduleEngine';
import { buildHumanPlanSummary, humanizeConflicts } from '@/lib/explanationEngine';
import { buildProactiveWarnings } from '@/lib/suggestionEngine';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    await requireSchedulePharmacyAccess(authUser, db);

    const {
      employees = [],
      schedules = [],
      vacationRequests = [],
      schedulePreferences = [],
      year,
      month,
      config,
      action = 'plan',
      sickEmployeeId,
      affectedDates = [],
    } = await request.json();

    if (!year || !month) {
      return NextResponse.json({ error: 'Hiányzó év vagy hónap' }, { status: 400 });
    }

    let plannerResult;
    if (action === 'validate') {
      plannerResult = {
        proposedShifts: [],
        generationConflicts: [],
        mergedSchedules: (schedules || []).filter((item) => item.status !== 'deleted'),
      };
    } else if (action === 'replan') {
      plannerResult = quickReplanForAbsence({
        employees,
        schedules,
        vacationRequests,
        schedulePreferences,
        year,
        month,
        config,
        sickEmployeeId,
        affectedDates,
      });
    } else {
      plannerResult = generateAutoSchedulePlan({
        employees,
        schedules,
        vacationRequests,
        schedulePreferences,
        year,
        month,
        config,
      });
    }

    const mergedSchedules = plannerResult.mergedSchedules;
    const conflicts = [
      ...detectScheduleConflicts({
        employees,
        schedules: mergedSchedules,
        vacationRequests,
        schedulePreferences,
        year,
        month,
        config,
      }),
      ...(plannerResult.generationConflicts || []),
    ];

    const suggestions = buildPlannerSuggestions(conflicts);
    const stats = computePlannerStats({
      employees,
      schedules: mergedSchedules,
      vacationRequests,
      schedulePreferences,
      conflicts,
    });
    const humanSummary = buildHumanPlanSummary({ stats, conflicts });
    const humanConflictMessages = humanizeConflicts(conflicts);
    const proactiveWarnings = buildProactiveWarnings({ stats, conflicts });

    return NextResponse.json({
      success: true,
      proposedShifts: plannerResult.proposedShifts || [],
      conflicts,
      suggestions,
      stats,
      model: plannerResult.model || { name: 'RuleBasedPlanner' },
      planQuality: plannerResult.planQuality || null,
      alternatives: plannerResult.alternatives || [],
      assignmentReasons: plannerResult.assignmentReasons || [],
      humanSummary,
      humanConflictMessages,
      proactiveWarnings,
    });
  } catch (error) {
    console.error('Schedule planner API error:', error);
    return NextResponse.json({ error: error.message || 'Tervezési hiba történt' }, { status: error.status || 500 });
  }
}
