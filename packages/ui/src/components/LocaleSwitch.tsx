import React from "react";

interface LocaleSwitchLink {
  href: string;
  label: string;
  locale: string;
}

interface LocaleSwitchProps {
  currentLocale: string;
  locales: LocaleSwitchLink[];
}

export function LocaleSwitch({ currentLocale, locales }: LocaleSwitchProps) {
  return (
    <nav aria-label="Locale switch" className="locale-switch">
      <ul className="locale-switch__list">
        {locales.map((localeLink) => (
          <li key={localeLink.locale} className="locale-switch__item">
            <a
              className="locale-switch__link"
              aria-current={localeLink.locale === currentLocale ? "page" : undefined}
              href={localeLink.href}
            >
              {localeLink.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default LocaleSwitch;
