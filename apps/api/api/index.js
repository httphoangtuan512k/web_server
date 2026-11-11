// Vercel Function: mọi request được rewrite về đây (xem vercel.json), Nest đã build sẵn trong dist/.
const { getHandler } = require('../dist/serverless');

module.exports = async (req, res) => {
  const handler = await getHandler();
  return handler(req, res);
};
