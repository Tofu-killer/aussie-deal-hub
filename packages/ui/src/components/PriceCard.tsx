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

  return (
    <section aria-labelledby={currentPriceLabelId}>
      <p id={currentPriceLabelId}>{currentPriceLabel}</p>
      <strong>{currentPrice}</strong>
      {originalPrice ? (
        <p>
          <span>{originalPriceLabel}</span>
          <span>{originalPrice}</span>
        </p>
      ) : null}
      {discountLabel ? <p>{discountLabel}</p> : null}
      <a href={ctaHref}>{ctaLabel}</a>
    </section>
  );
}

export default PriceCard;
