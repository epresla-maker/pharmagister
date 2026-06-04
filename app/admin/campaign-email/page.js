"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import {
  SCHEDULE_MANAGER_CAMPAIGN_SUBJECT,
  SCHEDULE_MANAGER_CAMPAIGN_BODY,
  SCHEDULE_MANAGER_CAMPAIGN_URL,
  getScheduleManagerPushDraft,
} from "@/lib/scheduleManagerCampaign";

const ADMIN_EMAILS = ["epresla@icloud.com"];
const ADMINKA_EMAILS = ["etinatina22@gmail.com"];
const ALL_ADMIN_EMAILS = [...ADMIN_EMAILS, ...ADMINKA_EMAILS];

export default function CampaignEmailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pushDraft = getScheduleManagerPushDraft();

  useEffect(() => {
    if (loading) return;
    if (!user || !ALL_ADMIN_EMAILS.includes(user.email)) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user || !ALL_ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Mail className="text-amber-600" size={24} />
              <h1 className="text-xl sm:text-2xl font-bold">Kampány levél szöveg</h1>
            </div>
            <button
              onClick={() => router.push("/admin")}
              className="flex items-center gap-1 text-amber-700 hover:text-amber-900 text-sm"
            >
              <ArrowLeft size={16} />
              Vissza
            </button>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4 text-sm text-amber-900">
            Ezt a sablont használjátok a gyógyszertáraknak küldött beosztáskezelő kampánylevélhez.
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-1">Tárgy</p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
              {SCHEDULE_MANAGER_CAMPAIGN_SUBJECT}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Levél törzs</p>
            <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm leading-6 text-gray-800">
              {SCHEDULE_MANAGER_CAMPAIGN_BODY}
            </pre>
          </div>

          <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <p className="text-xs font-semibold text-indigo-900 mb-1">Push céloldal (még nincs kiküldve)</p>
            <p className="text-sm text-indigo-900">Értesítés kattintás URL: <span className="font-mono">{SCHEDULE_MANAGER_CAMPAIGN_URL}</span></p>
            <pre className="mt-2 whitespace-pre-wrap rounded border border-indigo-200 bg-white p-2 text-xs text-indigo-900">
{JSON.stringify(pushDraft, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
