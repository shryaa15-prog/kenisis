
import { handler } from '../server/index.js';

export default async function apiHandler(req, res) {
  return handler(req, res);
}
