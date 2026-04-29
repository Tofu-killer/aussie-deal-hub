import React, { type ReactNode } from "react";

import {
  buildLocaleHref,
  type PublicDealRecord,
  type SupportedLocale,
} from "../lib/publicDeals";

interface DealDiscoveryCardProps {
  deal: PublicDealRecord;
  footer?: ReactNode;
  locale: SupportedLocale;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  summary?: string;
}

function hasExternalDealUrl(dealUrl: string) {
  return dealUrl.length > 0 && dealUrl !== "#";
}

export default function DealDiscoveryCard({
  deal,
  footer,
  locale,
  primaryActionLabel,
  secondaryActionLabel,
  summary,
}: DealDiscoveryCardProps) {
  const detailHref = buildLocaleHref(locale, `/deals/${deal.slug}`);
  const primaryHref = hasExternalDealUrl(deal.dealUrl) ? deal.dealUrl : detailHref;
  const merchantName =
    "merchant" in deal && deal.merchant && typeof deal.merchant === "object" && "name" in deal.merchant
      ? deal.merchant.name
      : null;
  const externalTargetProps = hasExternalDealUrl(deal.dealUrl)
    ? {
        rel: "noreferrer",
        target: "_blank",
      }
    : {};

  return (
    <article className="deal-card">
      <div className="deal-card__meta">
        {merchantName ? <span className="deal-card__merchant">{merchantName}</span> : <span />}
        <span className="deal-card__price">{deal.currentPrice}</span>
      </div>
      <h3 className="deal-card__title">
        <a href={primaryHref} {...externalTargetProps}>
          {deal.locales[locale].title}
        </a>
      </h3>
      <p className="deal-card__summary">{summary ?? deal.locales[locale].summary}</p>
      <div className="deal-card__actions">
        <a className="deal-card__primary-cta" href={primaryHref} {...externalTargetProps}>
          {hasExternalDealUrl(deal.dealUrl) ? primaryActionLabel : secondaryActionLabel}
        </a>
        {hasExternalDealUrl(deal.dealUrl) ? (
          <a className="deal-card__secondary-link" href={detailHref}>
            {secondaryActionLabel}
          </a>
        ) : null}
      </div>
      {footer ? <div className="deal-card__footer">{footer}</div> : null}
    </article>
  );
}
