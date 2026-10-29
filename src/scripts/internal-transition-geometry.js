/** Painted image rectangle, including the current hover transform. */
export function imageGeometry(box, clip, naturalWidth, naturalHeight, fit) {
  if (![box.left, box.top, box.width, box.height, clip.left, clip.top,
    clip.width, clip.height, naturalWidth, naturalHeight].every(Number.isFinite) ||
      box.width <= 0 || box.height <= 0 || naturalWidth <= 0 || naturalHeight <= 0 ||
      !['cover', 'contain'].includes(fit)) return null;
  const scale = Math[fit === 'cover' ? 'max' : 'min'](box.width / naturalWidth, box.height / naturalHeight);
  const width = naturalWidth * scale, height = naturalHeight * scale;
  const left = box.left + (box.width - width) / 2;
  const top = box.top + (box.height - height) / 2;
  const inset = [Math.max(0, clip.top - top) / height,
    Math.max(0, left + width - clip.left - clip.width) / width,
    Math.max(0, top + height - clip.top - clip.height) / height,
    Math.max(0, clip.left - left) / width].map(n => Math.min(1, n) * 100);
  if (inset[0] + inset[2] >= 100 || inset[1] + inset[3] >= 100) return null;
  return { left, top, width, height, inset };
}

export function validTransition(value, from, to, key, now) {
  return value?.version === 1 && value.from === from && value.to === to &&
    typeof value.model === 'string' && /^[a-z0-9-]+$/.test(value.model) &&
    ['hero', 'catalog'].includes(value.source) && value.key === key &&
    Number.isFinite(value.time) && now >= value.time && now - value.time < 15000 &&
    typeof value.asset === 'string' && (value.geometry === null || validGeometry(value.geometry));
}

export function validGeometry(value) {
  return value && [value.left, value.top, value.width, value.height].every(Number.isFinite) &&
    Number.isFinite(value.radius) && value.radius >= 0 && value.radius <= 100 &&
    value.width > 0 && value.height > 0 && Array.isArray(value.inset) && value.inset.length === 4 &&
    value.inset.every(n => Number.isFinite(n) && n >= 0 && n < 100) &&
    value.inset[0] + value.inset[2] < 100 && value.inset[1] + value.inset[3] < 100;
}
