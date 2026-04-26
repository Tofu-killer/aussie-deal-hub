INSERT INTO "MerchantCatalog" (
    "id",
    "name",
    "activeDeals",
    "primaryCategory",
    "status",
    "owner",
    "updatedAt"
)
VALUES
    ('amazon-au', 'Amazon AU', 42, 'Electronics', 'Active', 'Marketplace desk', CURRENT_TIMESTAMP),
    ('chemist-warehouse', 'Chemist Warehouse', 17, 'Health', 'Needs review', 'Retail desk', CURRENT_TIMESTAMP),
    ('the-iconic', 'The Iconic', 9, 'Fashion', 'Active', 'Lifestyle desk', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "TagCatalog" (
    "id",
    "name",
    "slug",
    "visibleDeals",
    "localization",
    "owner",
    "updatedAt"
)
VALUES
    ('gaming', 'Gaming', 'gaming', 18, 'EN + ZH ready', 'Discovery desk', CURRENT_TIMESTAMP),
    ('grocery', 'Grocery', 'grocery', 25, 'EN + ZH ready', 'Everyday desk', CURRENT_TIMESTAMP),
    ('travel', 'Travel', 'travel', 7, 'Needs ZH review', 'Lifestyle desk', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "TopicCatalog" (
    "id",
    "name",
    "slug",
    "spotlightDeals",
    "status",
    "owner",
    "updatedAt"
)
VALUES
    ('work-from-home', 'Work From Home', 'work-from-home', 6, 'Active', 'Discovery desk', CURRENT_TIMESTAMP),
    ('gaming-setup', 'Gaming Setup', 'gaming-setup', 9, 'Active', 'Discovery desk', CURRENT_TIMESTAMP),
    ('school-savings', 'School Savings', 'school-savings', 4, 'Seasonal', 'Everyday desk', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
