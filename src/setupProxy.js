const { handleClaudeRequest } = require('../api/claudeCore.cjs');

module.exports = function(app) {
  app.post('/api/claude', (req, res) => handleClaudeRequest(req, res));
};
