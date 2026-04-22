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
    <nav aria-label="Locale switch">
      <ul>
        {locales.map((localeLink) => (
          <li key={localeLink.locale}>
            <a
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
