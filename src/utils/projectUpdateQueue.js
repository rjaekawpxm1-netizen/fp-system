export const mergeProjectPatches = (currentPatch, nextPatch) => {
  const merged = { ...(currentPatch || {}), ...(nextPatch || {}) };
  if (currentPatch?.settings || nextPatch?.settings) {
    merged.settings = { ...(currentPatch?.settings || {}), ...(nextPatch?.settings || {}) };
  }
  return merged;
};

export const withoutProjectFields = (patch, fields = []) => Object.fromEntries(
  Object.entries(patch || {}).filter(([field]) => !fields.includes(field))
);

export const flushPendingProjectUpdates = (pendingUpdates, updateTimers, save, onError, omittedFieldsForProject = () => []) => {
  const entries = Object.entries(pendingUpdates || {});
  return entries.map(([id, updates]) => {
    if (updateTimers?.[id]) clearTimeout(updateTimers[id]);
    delete pendingUpdates[id];
    if (updateTimers) delete updateTimers[id];
    const updatesToSave = withoutProjectFields(updates, omittedFieldsForProject(id));
    if (!Object.keys(updatesToSave).length) return Promise.resolve();
    try {
      return Promise.resolve(save(id, updatesToSave)).catch(error => {
        if (onError) onError(error);
      });
    } catch (error) {
      if (onError) onError(error);
      return Promise.resolve();
    }
  });
};

export const registerProjectSaveFlush = (flush, doc = document, browserWindow = window) => {
  const handleVisibilityChange = () => {
    if (doc.hidden) flush();
  };
  const handlePageHide = () => flush();
  doc.addEventListener('visibilitychange', handleVisibilityChange);
  browserWindow.addEventListener('pagehide', handlePageHide);
  return () => {
    doc.removeEventListener('visibilitychange', handleVisibilityChange);
    browserWindow.removeEventListener('pagehide', handlePageHide);
  };
};
