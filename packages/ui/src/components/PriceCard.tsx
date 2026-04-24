import React from "react";

interface PriceCardProps {
  ctaHref?: string;
  ctaLabel: string;
  currentPrice: string;
  currentPriceLabel: string;
  discountLabel?: string;
  originalPrice?: string;
  originalPriceLabel?: string;
}

export function PriceCard({
  ctaHref = "#merchant",
  ctaLabel,
  currentPrice,
  currentPriceLabel,
  discountLabel,
  originalPrice,
  originalPriceLabel = "",
}: PriceCardProps) {
  const currentPriceLabelId = React.useId();
  const externalTargetProps = ctaHref.startsWith("http")
    ? {
        rel: "noreferrer",
        target: "_blank",
      }
    : {};

  return (
    <section aria-labelledby={currentPriceLabelId} className="price-card">
      <p id={currentPriceLabelId} className="price-card__label">
        {currentPriceLabel}
      </p>
      <strong className="price-card__current">{currentPrice}</strong>
      {originalPrice ? (
        <p className="price-card__original">
          <span>{originalPriceLabel}</span>
          <span>{originalPrice}</span>
        </p>
      ) : null}
      {discountLabel ? <p className="price-card__discount">{discountLabel}</p> : null}
      <a className="price-card__cta" href={ctaHref} {...externalTargetProps}>
        {ctaLabel}
      </a>
    </section>
  );
}

export default PriceCard;
