import type { APIRoute } from "astro";
import sharp from "sharp";
import { getModels } from "../../lib";

export async function getStaticPaths() {
  const models = await getModels();
  return models.map((model) => ({ params: { slug: model.id }, props: { model } }));
}

// Превью для ссылок (Telegram и др.): обложка по центру холста 1200×630 на фоне сайта.
export const GET: APIRoute = async ({ props }) => {
  const { cover } = props.model.data;
  const background = "#f5f2ec";
  const art = await sharp(cover.fsPath)
    .flatten({ background })
    .resize(1100, 570, { fit: "inside" })
    .toBuffer();
  const jpeg = await sharp({ create: { width: 1200, height: 630, channels: 3, background } })
    .composite([{ input: art, gravity: "center" }])
    .jpeg({ quality: 85 })
    .toBuffer();
  return new Response(jpeg, { headers: { "Content-Type": "image/jpeg" } });
};
