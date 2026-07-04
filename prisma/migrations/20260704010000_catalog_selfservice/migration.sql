-- Add SELF_SERVICE source for customer storefront (self-checkout) service links.
ALTER TYPE "CatalogServiceLinkSource" ADD VALUE IF NOT EXISTS 'SELF_SERVICE';
