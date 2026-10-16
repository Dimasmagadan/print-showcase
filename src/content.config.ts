import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const models = defineCollection({
  loader: glob({ pattern: "*/index.md", base: "./src/content/models" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      date: z.coerce.date(),
      tags: z.array(z.string()).default([]),
      cover: image(),
      coverAlt: z.string(),
      // contain — показать картинку целиком (широкие рендеры); cover — обрезать под карточку
      coverFit: z.enum(["cover", "contain"]).default("cover"),
      gallery: z
        .array(
          z.object({
            src: image(),
            alt: z.string(),
            kind: z.enum(["photo", "render"]).default("photo"),
          }),
        )
        .default([]),
      specs: z
        .object({
          material: z.string().optional(),
          size: z.string().optional(),
          layer: z.string().optional(),
          printTime: z.string().optional(),
          parts: z.number().int().optional(),
        })
        .default({}),
      // Локальный файл из public/ (например "/video/robot-cat.mp4") или ссылка на YouTube/VK/Rutube.
      video: z.string().optional(),
      tgPost: z.url().optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { models };
