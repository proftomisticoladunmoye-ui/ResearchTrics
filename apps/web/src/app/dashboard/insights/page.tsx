import { redirect } from 'next/navigation';

/** AI Insights was renamed and expanded into the AI Assistant. */
export default function InsightsRedirect() {
  redirect('/dashboard/assistant');
}
