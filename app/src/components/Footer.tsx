import { useState } from 'react';
import { FOOTER_PAGES, type FooterPageId } from '../footerContent';

export function Footer() {
  const [openPageId, setOpenPageId] = useState<FooterPageId | null>(null);
  const openPage = FOOTER_PAGES.find((page) => page.id === openPageId) ?? null;

  return (
    <>
      <footer className="footer">
        {FOOTER_PAGES.map((page) => (
          <button key={page.id} onClick={() => setOpenPageId(page.id)}>
            {page.label}
          </button>
        ))}
      </footer>

      <div
        className={`modal-backdrop${openPage ? ' show' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpenPageId(null);
        }}
      >
        {openPage && (
          <div className="legal-card">
            <h2 className="stamp">{openPage.title}</h2>
            {openPage.content}
            <button className="result-exit" onClick={() => setOpenPageId(null)}>
              Close
            </button>
          </div>
        )}
      </div>
    </>
  );
}
