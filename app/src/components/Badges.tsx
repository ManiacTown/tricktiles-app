import { useEffect, useState, type CSSProperties } from 'react';
import { useAuth } from '../supabase/useAuth';
import { getBadges, getUnlockedBadgeIds } from '../supabase/api';
import type { BadgeRarity, BadgeRow } from '../supabase/types';
import { SignIn } from './SignIn';

// Mirrors Pushdle's own RARITY_META (src/lib/game.js) — same four tiers,
// recolored to fit Tricktiles' light theme instead of Pushdle's dark one.
export const RARITY_META: Record<BadgeRarity, { label: string; color: string }> = {
  common: { label: 'Common', color: '#9a968a' },
  rare: { label: 'Rare', color: '#3f7fbf' },
  legendary: { label: 'Legendary', color: '#c9971f' },
  special: { label: 'Special', color: '#c14f7d' },
};

const RARITY_ORDER: Record<BadgeRarity, number> = { common: 0, rare: 1, legendary: 2, special: 3 };

// Only rare-and-up badges can be equipped as flair — same reasoning as
// Pushdle: common ones are too easy to earn to mean anything as a
// leaderboard flex. Tricktiles reuses each badge's own `icon` as its flair
// emoji (Pushdle keeps a separate BADGE_EMOJI map instead, since not every
// Pushdle badge has an icon at all — every Tricktiles badge already does).
function canBeFlair(badge: BadgeRow): boolean {
  return badge.rarity !== 'common';
}

export function Badges() {
  const { loading: authLoading, session, profile, signUp, signIn, updateSelectedEmoji } = useAuth();
  const [badges, setBadges] = useState<BadgeRow[] | null>(null);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [flairError, setFlairError] = useState<string | null>(null);
  const [flairBusy, setFlairBusy] = useState(false);

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

  const currentEmoji = profile.selected_emoji;

  async function handleBadgeClick(badge: BadgeRow) {
    if (!earnedIds.has(badge.id) || !canBeFlair(badge) || !badge.icon || flairBusy) return;
    setFlairError(null);
    setFlairBusy(true);
    try {
      await updateSelectedEmoji(currentEmoji === badge.icon ? null : badge.icon);
    } catch (err) {
      setFlairError(err instanceof Error ? err.message : 'Failed to update flair.');
    } finally {
      setFlairBusy(false);
    }
  }

  const categories = new Map<string, BadgeRow[]>();
  for (const badge of badges) {
    if (!categories.has(badge.category)) categories.set(badge.category, []);
    categories.get(badge.category)!.push(badge);
  }
  for (const list of categories.values()) {
    list.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
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
        <div className="small" style={{ marginTop: '8px' }}>
          Earn a rare-or-better badge, then tap it to wear its emoji next to your name.
        </div>
        {flairError && (
          <div style={{ color: 'var(--invalid)', fontSize: '12px', marginTop: '6px' }}>{flairError}</div>
        )}
      </div>

      <div className="badge-categories">
        {[...categories.entries()].map(([category, categoryBadges]) => (
          <div className="badge-container" key={category}>
            <h3>{category}</h3>
            <div className="badge-list">
              {categoryBadges.map((badge) => {
                const earned = earnedIds.has(badge.id);
                const flairEligible = earned && canBeFlair(badge) && !!badge.icon;
                const selected = flairEligible && currentEmoji === badge.icon;
                const rarity = RARITY_META[badge.rarity];
                return (
                  <div
                    className={`badge-card${earned ? ' badge-card-earned' : ''}${selected ? ' badge-card-selected' : ''}`}
                    key={badge.id}
                    style={{ '--rarity-color': rarity.color } as CSSProperties}
                    onClick={flairEligible ? () => handleBadgeClick(badge) : undefined}
                    role={flairEligible ? 'button' : undefined}
                    tabIndex={flairEligible ? 0 : undefined}
                    title={
                      flairEligible
                        ? selected
                          ? 'Tap to remove this flair'
                          : 'Tap to wear this flair'
                        : undefined
                    }
                  >
                    <div className="badge-rarity-pill" style={{ color: rarity.color, borderColor: rarity.color }}>
                      {rarity.label}
                    </div>
                    <div className="badge-icon">{badge.icon ?? '🏅'}</div>
                    <div className="badge-info">
                      <div className="badge-name">
                        {badge.name}
                        {selected && <span className="badge-flair-tag">WEARING</span>}
                      </div>
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
