import { useI18n } from '../i18n/I18nContext';

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.67-3.76-1.32-3.76-1.32-.5-1.28-1.24-1.62-1.24-1.62-1.02-.7.08-.69.08-.69 1.12.08 1.71 1.15 1.71 1.15 1 .1.8 2.13 3.4 1.51.1-.72.39-1.21.71-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.06 1.15a10.6 10.6 0 0 1 5.57 0c2.13-1.45 3.06-1.15 3.06-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.29-2.61 5.23-5.1 5.5.4.35.76 1.02.76 2.06v3.05c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.95H4.98V9.46h2.95v9.49ZM6.46 8.16a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.49 10.79H16v-4.62c0-1.1-.02-2.51-1.53-2.51-1.53 0-1.76 1.2-1.76 2.43v4.7h-2.95V9.46h2.83v1.3h.04c.39-.74 1.36-1.53 2.8-1.53 3 0 3.55 1.97 3.55 4.53v5.19Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

export function SiteFooter() {
  const { language } = useI18n();
  const fr = language === 'fr';

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__columns">
          <section className="site-footer__column" aria-labelledby="footer-contact-title">
            <h2 id="footer-contact-title">{fr ? 'Besoin d’aide ?' : 'Need help?'}</h2>
            <a href="mailto:rent823242@gmail.com">{fr ? 'Nous contacter' : 'Contact Us'}</a>
            <p>{fr ? 'Un projet personnel de Tommy Ren' : 'An independent project by Tommy Ren'}</p>
          </section>

          <section className="site-footer__column" aria-labelledby="footer-about-title">
            <h2 id="footer-about-title">{fr ? 'À propos' : 'About'}</h2>
            <a href="https://www.tianzeren.com/" target="_blank" rel="noreferrer">
              TianzeRen.com <LinkIcon />
            </a>
            <a href="https://www.tommyren.com/" target="_blank" rel="noreferrer">
              TommyRen.com <LinkIcon />
            </a>
            <p>
              {fr
                ? 'Simulateur de loterie à des fins de divertissement.'
                : 'Lottery simulator for entertainment only.'}
            </p>
          </section>

          <section
            className="site-footer__column site-footer__social"
            aria-labelledby="footer-social-title"
          >
            <h2 id="footer-social-title">{fr ? 'Retrouvez Tommy' : 'Connect with Tommy'}</h2>
            <div className="site-footer__social-links">
              <a
                href="https://github.com/Tommy-Ren/BC-Lottery-Simulator"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub project"
              >
                <GitHubIcon /> <span>GitHub</span>
              </a>
              <a
                href="https://www.linkedin.com/in/tommy-ren/"
                target="_blank"
                rel="noreferrer"
                aria-label="Tommy Ren on LinkedIn"
              >
                <LinkedInIcon /> <span>LinkedIn</span>
              </a>
            </div>
            <p>
              {fr ? 'Créé par' : 'Created by'} <strong>Tommy Ren</strong>
            </p>
          </section>
        </div>

        <div className="site-footer__bottom">
          <p>
            {fr
              ? 'Ce site est un simulateur indépendant. Tous les soldes, billets et gains sont virtuels et sans valeur monétaire.'
              : 'This is an independent simulator. All balances, tickets and prizes are virtual and have no cash value.'}
          </p>
          <span>© {new Date().getFullYear()} Tommy Ren</span>
        </div>
      </div>
    </footer>
  );
}
