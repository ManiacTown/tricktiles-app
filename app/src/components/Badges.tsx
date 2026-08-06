import { useEffect, useState } from 'react';
import { useAuth } from '../supabase/useAuth';
import { getBadges, getUnlockedBadgeIds } from '../supabase/api';
import type { BadgeRow } from '../supabase/types';
import { SignIn } from './SignIn';

// Client-side-only grouping — the badges table itself has no category
// column, so this is purely a display-time lookup keyed by slug, not
// persisted anywhere. These two entries are the placeholder badges seeded
// alongside this page; replace this map (and consider a real `category`
// column via a migration, once there's DB access to apply one) once the
// actual badge list — names, criteria, icons, categories — is in hand.
// Anything not listed here falls back to "General".
const BADGE_CATEGORIES: Record<string, string> = {
  placeholder_first_solve: 'Milestones',
  placeholder_speedy: 'Skill',
};

function categoryFor(slug: string): string {
  return BADGE_CATEGORIES[slug] ?? 'General';
}

export function Badges() {
  const { loading: authLoading, session, profile, signUp, signIn } = useAuth();
  const [badges, setBadges] = useState<BadgeRow[] | null>(null);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    Promise.all([getBadges(), getUnlockedBadgeIds(session.user.id)])
      .then(([b, earned]) => {
        if (!cancelled) {
          setBadges(b);
          setEarnedIds(earned);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load badges.');
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (authLoading) {
    return <div className="status">Loading...</div>;
  }

  if (!session || !profile) {
    return <SignIn onSignUp={signUp} onSignIn={signIn} />;
  }

  if (error) {
    return <div className="status">{error}</div>;
  }

  if (!badges) {
    return <div className="status">Loading badges...</div>;
  }

  const categories = new Map<string, BadgeRow[]>();
  for (const badge of badges) {
    const category = categoryFor(badge.slug);
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category)!.push(badge);
  }

  return (
    <>
      <div className="badges-header">
        <h2 className="stamp" style={{ margin: 0 }}>
          Badges
        </h2>
        <div className="subtitle" style={{ marginTop: '4px' }}>
          {earnedIds.size} / {badges.length} earned
        </div>
      </div>

      <div className="badge-categories">
        {[...categories.entries()].map(([category, categoryBadges]) => (
          <div className="badge-container" key={category}>
            <h3>{category}</h3>
            <div className="badge-list">
              {categoryBadges.map((badge) => {
                const earned = earnedIds.has(badge.id);
                return (
                  <div className={`badge-card${earned ? ' badge-card-earned' : ''}`} key={badge.id}>
                    <div className="badge-icon">{badge.icon ?? '🏅'}</div>
                    <div className="badge-info">
                      <div className="badge-name">{badge.name}</div>
                      <div className="badge-description">{badge.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
