"use client";

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import RouteGuard from '@/app/components/RouteGuard';
import {
  SCHEDULE_MANAGER_CAMPAIGN_SUBJECT,
  SCHEDULE_MANAGER_CAMPAIGN_SUBJECT_DE,
  SCHEDULE_MANAGER_CAMPAIGN_BODY,
  SCHEDULE_MANAGER_CAMPAIGN_BODY_DE,
} from '@/lib/scheduleManagerCampaign';
import { getClientMarket } from '@/lib/marketI18n';

const ADMIN_EMAIL = 'epresla@icloud.com';

export default function ScheduleManagerCampaignClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const market = getClientMarket();

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      router.replace('/');
    }
  }, [user, loading, isAdmin, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (user && !isAdmin) {
    return null;
  }

  const campaignBody = market === 'de' ? SCHEDULE_MANAGER_CAMPAIGN_BODY_DE : SCHEDULE_MANAGER_CAMPAIGN_BODY;
  const pageSubject = market === 'de' ? SCHEDULE_MANAGER_CAMPAIGN_SUBJECT_DE : SCHEDULE_MANAGER_CAMPAIGN_SUBJECT;

  const pageBody = campaignBody
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('Elérhetőség:') && !trimmed.startsWith('Kontakt:');
    })
    .join('\n');
  const bodyParagraphs = pageBody.split('\n\n');

  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow p-4 sm:p-6">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">{market === 'de' ? 'Pharmagister Information' : 'Pharmagister tájékoztató'}</p>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{pageSubject}</h1>
            </div>

            <div className="text-[17px] leading-9 text-gray-800 bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5">
              {bodyParagraphs.map((paragraph, index) => {
                const isList = /^(-\s|\d+\.\s)/.test(paragraph.trim());

                if (isList) {
                  return (
                    <div key={index} className="mb-5 space-y-1">
                      {paragraph.split('\n').map((line, lineIndex) => (
                        <p key={`${index}-${lineIndex}`}>{line}</p>
                      ))}
                    </div>
                  );
                }

                return (
                  <p key={index} className="mb-5">
                    {paragraph}
                  </p>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/pharmagister"
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {market === 'de' ? 'Zurueck zu Pharmagister' : 'Vissza a Pharmagisterhez'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}