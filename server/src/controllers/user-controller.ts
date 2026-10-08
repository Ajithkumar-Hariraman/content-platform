import type { RequestHandler } from 'express';
import type { UserService } from '../services/user-service.js';
import {
  parseUserId,
  parseUserQuery,
  parseCreateUser,
  parseRole,
  parseStatus,
} from '../validation/auth.js';
export class UserController {
  constructor(private readonly service: UserService) {}
  list: RequestHandler = async (req, res) => {
    const query = parseUserQuery(req.query);
    res.json(await this.service.list(query.page, query.limit));
  };
  create: RequestHandler = async (req, res) => {
    const user = await this.service.create(parseCreateUser(req.body));
    res.status(201).json({ data: user });
  };
  role: RequestHandler = async (req, res) => {
    res.json({
      data: await this.service.changeAccess(
        parseUserId(req.params.id),
        parseRole(req.body),
      ),
    });
  };
  status: RequestHandler = async (req, res) => {
    res.json({
      data: await this.service.changeAccess(
        parseUserId(req.params.id),
        parseStatus(req.body),
      ),
    });
  };
}
