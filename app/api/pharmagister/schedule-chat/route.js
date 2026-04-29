import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';
import { parseBettiIntent } from '@/lib/intentParser';
import { explainAssignmentDecision } from '@/lib/explanationEngine';
import { buildProactiveWarnings } from '@/lib/suggestionEngine';
import {
  detectTrainingInput,
  loadTrainingPatterns,
  saveTrainingPattern,
  buildTrainingPattern,
} from '@/lib/bettiTraining';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Nincs jogosultsag' }, { status: 401 });
    }

    const body = await request.json();
    const message = body?.message || '';
    const context = body?.context || {};
    const uid = authUser.uid;
    const previousMessageIntent = body?.previousMessageIntent;

    // Check if this is a training input (starts with "xx ")
    const training = detectTrainingInput(message);
    
    if (training.isTraining && previousMessageIntent) {
      // This is a training message - save the pattern
      console.log('[Betti Training]', { message, previousMessageIntent, lastUserMessage: context.lastUserMessage });
      
      const pattern = buildTrainingPattern(
        previousMessageIntent,
        context.lastUserMessage || 'unknown',
        training.trainingResponse
      );
      
      console.log('[Betti Training] Pattern to save:', pattern);
      const saveResult = await saveTrainingPattern(uid, pattern);
      console.log('[Betti Training] Save result:', saveResult);
      
      if (saveResult.success) {
        // Force reload patterns after saving (small delay for Firestore consistency)
        setTimeout(() => {
          console.log('[Betti Training] Pattern saved, will reload next request');
        }, 500);
        
        return NextResponse.json({
          success: true,
          isTraining: true,
          intent: 'training_saved',
          reply: `✓ Megtanultam! Legközelebb ha azt kérdezed: "${context.lastUserMessage || 'это'}" erre válaszolok: "${training.trainingResponse}"`,
          payload: {
            action: 'training_saved',
            pattern,
          },
          quickActions: [],
        });
      } else {
        // Training save failed - return error
        console.error('[Betti Training] Save failed:', saveResult.error);
        return NextResponse.json({
          success: false,
          error: `Tanítás sikertelen: ${saveResult.error || 'Ismeretlen hiba'}`,
          details: saveResult.error,
        }, { status: 500 });
      }
    }

    // Load learned patterns ONLY for normal (non-training) messages
    const learnedPatterns = await loadTrainingPatterns(uid);
    if (learnedPatterns.length > 0) {
      console.log(`[Betti] Loaded ${learnedPatterns.length} learned patterns for user ${uid}`);
    }

    // Normal message processing with learned patterns
    const parsed = parseBettiIntent(message, learnedPatterns);
    const proactiveWarnings = buildProactiveWarnings({
      stats: context.stats || null,
      conflicts: Array.isArray(context.conflicts) ? context.conflicts : [],
    });

    let reply = parsed.reply;
    let payload = {
      action: parsed.action,
      entities: parsed.entities,
      confidence: parsed.confidence,
    };

    if (parsed.intent === 'explain_assignment') {
      const explained = explainAssignmentDecision({
        assignmentReasons: context.assignmentReasons || [],
        employeeName: parsed.entities?.person || undefined,
      });
      reply = `${explained.title}\n- ${explained.bullets.join('\n- ')}`;
      payload = {
        ...payload,
        explanation: explained,
      };
    }

    if (parsed.intent === 'report_overtime') {
      const rows = context?.stats?.employees || [];
      const overtimeRows = rows
        .filter((item) => Number(item.overtimeHours || 0) > 0)
        .sort((a, b) => Number(b.overtimeHours || 0) - Number(a.overtimeHours || 0))
        .slice(0, 5);

      if (overtimeRows.length === 0) {
        reply = 'Jelenleg nincs olyan dolgozo, aki tuloraban lenne.';
      } else {
        reply = `Tulorasok: ${overtimeRows.map((item) => `${item.name} (${item.overtimeHours}h)`).join(', ')}`;
      }

      payload = {
        ...payload,
        overtimeRows,
      };
    }

    if (parsed.intent === 'my_schedule') {
      reply = 'Rendben, megmutatom a sajat muszakjaidat. Ha dolgozoi nezetben vagy, pontos listat is kapsz.';
    }

    if (parsed.intent === 'my_vacation') {
      reply = 'Rendben, megnezem a szabadsag napjaidat.';
    }

    if (parsed.intent === 'my_free_days') {
      reply = 'Rendben, kilistazom a kovetkezo szabadnapjaidat.';
    }

    if (parsed.intent === 'write_schedule_plan') {
      reply = 'Rendben, segitek beosztas-tervezetet irni. Nyisd meg a Beosztas-tervezo reszt, vagy mondd: "Beosztast szeretnek irni".';
    }

    if (parsed.intent === 'greeting') {
      reply = 'Szia! Betti vagyok 👋 Kerdezhetsz ilyet is: "Mi a beosztasom?", "Mikor vagyok szabin?", vagy "Mutasd a tulorasokat".';
    }

    if (parsed.intent === 'thanks' || parsed.intent === 'ack') {
      reply = 'Szivesen! Ha szeretned, mar most megmutatom a kovetkezo muszakjaidat vagy szabadnapjaidat.';
    }

    return NextResponse.json({
      success: true,
      intent: parsed.intent,
      reply,
      payload,
      proactiveWarnings,
      quickActions: [
        { key: 'replan_all', label: 'Ujratervezes' },
        { key: 'optimize_fairness', label: 'Igazsagosabb verzio' },
        { key: 'optimize_overtime', label: 'Kevesebb tulora' },
        { key: 'replan_specific_day', label: 'Csak egy nap ujratervezese' },
        { key: 'minimal_change_replan', label: 'Legkisebb valtoztatas' },
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Betti most nem tudta ertelmezni a kerest. Probald meg ujra rovidebben.',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
