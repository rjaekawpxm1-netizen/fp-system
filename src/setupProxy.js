const express = require('express');
const { handleClaudeRequest } = require('../api/claudeCore.cjs');

module.exports = function(app) {
  app.post('/api/claude', express.json({ limit: '1mb' }), (req, res) => handleClaudeRequest(req, res));
};
