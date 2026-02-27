// Global error handler — always return JSON, never HTML
function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message || err);
  if (err.stack) console.error(err.stack);

  // Prevent sending headers after they've already been sent
  if (res.headersSent) {
    return next(err);
  }

  var statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({ error: err.message || 'Internal server error' });
}

module.exports = errorHandler;
