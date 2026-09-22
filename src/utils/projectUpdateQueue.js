export const mergeProjectPatches = (currentPatch, nextPatch) => ({
  ...(currentPatch || {}),
  ...(nextPatch || {}),
});
