export type FooterPageId = 'about' | 'privacy' | 'terms' | 'updates';

export interface FooterPage {
  id: FooterPageId;
  label: string;
  title: string;
  content: JSX.Element;
}

export const FOOTER_PAGES: FooterPage[] = [
  {
    id: 'about',
    label: 'About',
    title: 'About TrickTiles',
    content: (
      <>
        <p>
          TrickTiles is a daily word-tile puzzle game inspired by Bananagrams. Every day, everyone gets the same
          set of tiles split across four rounds — drag letters onto the board to build a fully connected grid
          where every row and column is a real word.
        </p>
        <p>
          There's also an untimed Practice mode for playing anytime with a random set of tiles, plus a Profile
          page to track your stats and see how you stack up on the daily leaderboard.
        </p>
        <p>TrickTiles is an independent, small-scale project — thanks for playing!</p>
      </>
    ),
  },
  {
    id: 'privacy',
    label: 'Privacy Policy',
    title: 'Privacy Policy',
    content: (
      <>
        <p>
          <em>
            This is a basic policy for a small, independent project — not reviewed by a lawyer. If you have
            questions about your data, please reach out.
          </em>
        </p>
        <p>
          <strong>What we collect:</strong> if you create an account, we store your email address, a
          username, and your gameplay stats (completed puzzles, scores, and times) so we can show your
          progress and the daily leaderboard.
        </p>
        <p>
          <strong>Local device settings:</strong> preferences like your sound on/off setting are saved only in
          your browser (using a technology called localStorage) and are never sent to our servers.
        </p>
        <p>
          <strong>No ads or trackers:</strong> TrickTiles does not use third-party advertising or analytics
          trackers.
        </p>
        <p>
          <strong>Storage:</strong> account data is stored with Supabase, a third-party backend provider, using
          their standard security practices.
        </p>
        <p>
          <strong>Questions?</strong> Reach out to the developer directly if you'd like your data removed or
          have any concerns.
        </p>
      </>
    ),
  },
  {
    id: 'terms',
    label: 'Terms of Service',
    title: 'Terms of Service',
    content: (
      <>
        <p>
          <em>
            This is a basic set of terms for a small, independent project — not reviewed by a lawyer.
          </em>
        </p>
        <p>
          <strong>The service:</strong> TrickTiles is a free hobby word-puzzle game, provided "as is" without
          any guarantee of uptime, availability, or that it will be free of bugs.
        </p>
        <p>
          <strong>Accounts:</strong> one account per person, please. Don't share accounts or use automated
          tools/bots to play or to manipulate the leaderboard.
        </p>
        <p>
          <strong>Fair play:</strong> exploiting bugs to gain an unfair leaderboard advantage may result in
          your scores being removed or your account being restricted.
        </p>
        <p>
          <strong>No warranty:</strong> as a small side project, TrickTiles comes with no warranty of any kind.
          Use it for fun, at your own risk.
        </p>
        <p>
          <strong>Changes:</strong> these terms may change over time. Continuing to use TrickTiles after a
          change means you accept the updated terms.
        </p>
      </>
    ),
  },
  {
    id: 'updates',
    label: 'Updates',
    title: "What's New",
    content: (
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li style={{ marginBottom: '10px' }}>
          <strong>2026-08-24</strong> — Added sound effects for placing tiles, invalid moves, and completing
          rounds/puzzles, plus a mute button in the HUD.
        </li>
      </ul>
    ),
  },
];
