import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';
import {
  buildPlannerSuggestions,
  computePlannerStats,
  detectScheduleConflicts,
  generateAutoSchedulePlan,
  quickReplanForAbsence,
} from '@/lib/scheduleEngine';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 401 });
    }

    const {
      employees = [],
      schedules = [],
      vacationRequests = [],
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
      conflicts,
    });

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
    });
  } catch (error) {
    console.error('Schedule planner API error:', error);
    return NextResponse.json({ error: error.message || 'Tervezési hiba történt' }, { status: 500 });
  }
}
