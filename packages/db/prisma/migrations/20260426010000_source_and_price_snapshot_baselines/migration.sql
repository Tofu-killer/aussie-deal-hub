INSERT INTO "Source" (
    "id",
    "name",
    "sourceType",
    "baseUrl",
    "fetchMethod",
    "pollIntervalMinutes",
    "trustScore",
    "language",
    "enabled",
    "updatedAt"
)
VALUES
    (
        'source-ozbargain',
        'OzBargain',
        'community',
        'https://www.ozbargain.com.au/deals',
        'html',
        60,
        65,
        'en',
        true,
        CURRENT_TIMESTAMP
    ),
    (
        'source-choice-deals',
        'Choice Deals',
        'publisher',
        'https://www.choice.com.au/',
        'html',
        360,
        70,
        'en',
        false,
        CURRENT_TIMESTAMP
    ),
    (
        'source-smzdm',
        'SMZDM',
        'community',
        'https://www.smzdm.com',
        'html',
        720,
        60,
        'zh',
        false,
        CURRENT_TIMESTAMP
    )
ON CONFLICT ("baseUrl") DO NOTHING;

INSERT INTO "PriceSnapshot" (
    "id",
    "dealSlug",
    "label",
    "merchant",
    "price",
    "observedAt"
)
SELECT
    'snapshot-nintendo-switch-oled-amazon-au-previous-promo',
    'nintendo-switch-oled-amazon-au',
    'Previous promo',
    'Amazon AU',
    429.00,
    TIMESTAMP '2025-03-14 00:00:00.000'
WHERE NOT EXISTS (
    SELECT 1
    FROM "PriceSnapshot"
    WHERE "dealSlug" = 'nintendo-switch-oled-amazon-au'
      AND "label" = 'Previous promo'
      AND "merchant" = 'Amazon AU'
      AND "price" = 429.00
      AND "observedAt" = TIMESTAMP '2025-03-14 00:00:00.000'
);

INSERT INTO "PriceSnapshot" (
    "id",
    "dealSlug",
    "label",
    "merchant",
    "price",
    "observedAt"
)
SELECT
    'snapshot-nintendo-switch-oled-amazon-au-current-public-deal',
    'nintendo-switch-oled-amazon-au',
    'Current public deal',
    'Amazon AU',
    399.00,
    TIMESTAMP '2025-04-15 00:00:00.000'
WHERE NOT EXISTS (
    SELECT 1
    FROM "PriceSnapshot"
    WHERE "dealSlug" = 'nintendo-switch-oled-amazon-au'
      AND "label" = 'Current public deal'
      AND "merchant" = 'Amazon AU'
      AND "price" = 399.00
      AND "observedAt" = TIMESTAMP '2025-04-15 00:00:00.000'
);
