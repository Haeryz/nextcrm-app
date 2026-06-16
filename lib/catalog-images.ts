import fs from "fs";
import path from "path";

export function getExistingCatalogImagePath(imagePath: string | null): string | null {
  if (!imagePath) return null;
  if (/^https?:\/\//.test(imagePath)) return imagePath;
  if (!imagePath.startsWith("/")) return null;

  const publicPath = path.resolve(process.cwd(), "public", imagePath.slice(1));
  const publicRoot = path.resolve(process.cwd(), "public");
  if (!publicPath.startsWith(publicRoot + path.sep)) return null;

  return fs.existsSync(publicPath) ? imagePath : null;
}
