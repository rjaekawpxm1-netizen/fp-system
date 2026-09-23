export const mergeProjectPatches = (currentPatch, nextPatch) => {
  const merged = { ...(currentPatch || {}), ...(nextPatch || {}) };
  if (currentPatch?.settings || nextPatch?.settings) {
    merged.settings = { ...(currentPatch?.settings || {}), ...(nextPatch?.settings || {}) };
  }
  return merged;
};

export const flushPendingProjectUpdates = (pendingUpdates, updateTimers, save, onError) => {
  const entries = Object.entries(pendingUpdates || {});
  return entries.map(([id, updates]) => {
    if (updateTimers?.[id]) clearTimeout(updateTimers[id]);
    delete pendingUpdates[id];
    if (updateTimers) delete updateTimers[id];
    try {
      return Promise.resolve(save(id, updates)).catch(error => {
        if (onError) onError(error);
      });
    } catch (error) {
      if (onError) onError(error);
      return Promise.resolve();
    }
  });
};
