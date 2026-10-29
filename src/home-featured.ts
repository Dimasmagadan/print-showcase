// Changing the subject also requires preparing and reviewing its motion media.
export const HOME_FEATURED_MODEL_ID = "robot-cat";
// Reviewed image imports are registered by subject in home-featured-media.ts.

export function orderHomeModels<T extends { id: string; data: { draft?: boolean; date: Date } }>(models: T[]) {
  const published = models.filter((model) => !model.data.draft);
  const featured = published.find((model) => model.id === HOME_FEATURED_MODEL_ID);
  const rest = published
    .filter((model) => model !== featured)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
  return { featured, models: featured ? [featured, ...rest] : rest };
}
