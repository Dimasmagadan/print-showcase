/** Account for owned decoded frames and decode reservations across both scenes. */
export function recordRobotCatMemory(root, owner, bytes) {
  if (!root || (owner !== 'story' && owner !== 'playground')) return;
  const amount = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  root.dataset[owner === 'story' ? 'storyAccountedBytes' : 'playgroundAccountedBytes'] = String(amount);
  const total = Number(root.dataset.storyAccountedBytes || 0) + Number(root.dataset.playgroundAccountedBytes || 0);
  root.dataset.combinedAccountedBytes = String(total);
  root.dataset.combinedPeakBytes = String(Math.max(Number(root.dataset.combinedPeakBytes || 0), total));
}
