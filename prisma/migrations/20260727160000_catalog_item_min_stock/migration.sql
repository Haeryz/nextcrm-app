-- AddColumn: minStock (default 0) so each CatalogItem can carry its own
-- low-stock threshold. Used by the catalogue/item "Stok Rendah" indicator
-- and the inventory spreadsheet row colouring.
ALTER TABLE "CatalogItem"
ADD COLUMN "minStock" INTEGER NOT NULL DEFAULT 0;
