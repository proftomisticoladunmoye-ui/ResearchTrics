import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { updateProfile, setInterests, authorize, validationError, unauthorized } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  displayName: z.string().min(2).max(120).optional(),
  givenNames: z.string().max(120).nullish(),
  familyName: z.string().max(120).nullish(),
  preferredName: z.string().max(120).nullish(),
  biography: z.string().max(5000).nullish(),
  country: z.string().max(80).nullish(),
  city: z.string().max(80).nullish(),
  academicRank: z.string().max(120).nullish(),
  website: z.string().url().max(300).nullish().or(z.literal('')),
  photoUrl: z.string().max(500).nullish().or(z.literal('')),
  profileVisibility: z.enum(['public', 'researchers', 'institution', 'private']).optional(),
  interests: z.array(z.string().min(1).max(80)).max(30).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized();

    // Ownership check via the RBAC gate (Spec §6).
    if (!authorize(user.actor, 'researcher:update:self', { ownerUserId: user.id })) {
      throw unauthorized();
    }

    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid profile update', parsed.error.flatten());

    const { interests, website, photoUrl, ...profile } = parsed.data;
    await updateProfile(
      user.researcher.id,
      {
        ...profile,
        ...(website !== undefined ? { website: website === '' ? null : website } : {}),
        ...(photoUrl !== undefined ? { photoUrl: photoUrl === '' ? null : photoUrl } : {}),
      },
      user.id,
    );
    if (interests) await setInterests(user.researcher.id, interests);

    return ok({ updated: true });
  } catch (err) {
    return fail(err);
  }
}
