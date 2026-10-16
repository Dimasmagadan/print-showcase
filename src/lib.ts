import { getCollection } from "astro:content";

export async function getModels() {
  const models = await getCollection("models", ({ data }) => !data.draft);
  return models.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function formatDate(date: Date) {
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

// YouTube / VK / Rutube → embed-ссылка; локальный файл → null (рисуем <video>).
export function videoEmbed(src: string): string | null {
  if (!/^https?:/.test(src)) return null;
  const yt = src.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const rutube = src.match(/rutube\.ru\/video\/([\da-f]+)/);
  if (rutube) return `https://rutube.ru/play/embed/${rutube[1]}`;
  const vk = src.match(/vk(?:video)?\.(?:com|ru)\/video(-?\d+)_(\d+)/);
  if (vk) return `https://vkvideo.ru/video_ext.php?oid=${vk[1]}&id=${vk[2]}`;
  return src;
}
