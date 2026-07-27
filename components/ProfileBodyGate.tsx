'use client';

import { FolderPlus } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { emptyBody } from '@/lib/tree/body';

/**
 * What the intake, curation and strategy surfaces show on a profile that has
 * not been moved into the new structure yet.
 *
 * A profile carrying real work is moved by the migration, one at a time, with a
 * report she reads first (spec 21 §9). Nothing here does that job. A profile
 * that has nothing to move can simply be started empty, and that is the only
 * case this offers.
 */
export default function ProfileBodyGate({ clientId }: { clientId: string }) {
  const { dispatch } = useApp();
  const { data } = useClient(clientId);

  const hasLegacyWork =
    (data.onboarding?.length ?? 0) > 0 ||
    (data.contentCards?.length ?? 0) > 0 ||
    (data.pillars?.length ?? 0) > 0 ||
    (data.assetSets?.length ?? 0) > 0 ||
    !!data.brand?.tagline;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="bg-white border border-stone-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-stone-900">This profile is not in the new structure yet</h2>
        {hasLegacyWork ? (
          <p className="text-sm text-stone-500 mt-2">
            It already holds work, so it has to be moved across properly. Run the migration for this
            profile first. It shows you a report of everything it moved and everything it refused to
            guess, and it changes nothing until you say so.
          </p>
        ) : (
          <>
            <p className="text-sm text-stone-500 mt-2">
              There is nothing here to move across, so it can just start.
            </p>
            <button
              onClick={() => dispatch({ type: 'SET_BODY', payload: { clientId, body: emptyBody() } })}
              className="mt-4 flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white rounded-lg bg-stone-900 hover:opacity-90"
            >
              <FolderPlus size={15} /> Start this profile
            </button>
          </>
        )}
      </div>
    </div>
  );
}
