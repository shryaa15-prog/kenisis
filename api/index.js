// Vercel serverless entry point.
// Loads the Express app from server/app.js and hands every /api/* request to it.
// Works whether server/app.js uses CommonJS (module.exports = app)
// or ES modules (export default app).

module.exports = async (req, res) => {
  const mod = await import("../server/app.js");
  const app = mod.default || mod;
  return app(req, res);
};
