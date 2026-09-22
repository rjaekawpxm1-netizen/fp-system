export const mergeProjectPatches = (currentPatch, nextPatch) => {
  const merged = { ...(currentPatch || {}), ...(nextPatch || {}) };
  if (currentPatch?.settings || nextPatch?.settings) {
    merged.settings = { ...(currentPatch?.settings || {}), ...(nextPatch?.settings || {}) };
  }
  return merged;
};
