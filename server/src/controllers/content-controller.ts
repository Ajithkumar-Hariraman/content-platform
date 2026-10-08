import type { RequestHandler } from 'express';
import type { ContentService } from '../services/content-service.js';
import {
  parseContentId,
  parseContentSlug,
  parseContentQuery,
  parseCreateContent,
  parseUpdateContent,
} from '../validation/content.js';
export class ContentController {
  constructor(private readonly service: ContentService) {}
  adminList: RequestHandler = async (req, res) => {
    res.json(await this.service.list(parseContentQuery(req.query)));
  };
  publicList: RequestHandler = async (req, res) => {
    res.json(await this.service.list(parseContentQuery(req.query, true), true));
  };
  detail: RequestHandler = async (req, res) => {
    res.json({
      data: await this.service.findById(parseContentId(req.params.id)),
    });
  };
  publicDetail: RequestHandler = async (req, res) => {
    res.json({
      data: await this.service.findPublishedBySlug(
        parseContentSlug(req.params.slug),
      ),
    });
  };
  create: RequestHandler = async (req, res) => {
    const content = await this.service.create(parseCreateContent(req.body));
    res
      .location(`/api/v1/admin/content/${content.id}`)
      .status(201)
      .json({ data: content });
  };
  update: RequestHandler = async (req, res) => {
    res.json({
      data: await this.service.update(
        parseContentId(req.params.id),
        parseUpdateContent(req.body),
      ),
    });
  };
  publish: RequestHandler = async (req, res) => {
    res.json({
      data: await this.service.publish(parseContentId(req.params.id)),
    });
  };
  archive: RequestHandler = async (req, res) => {
    res.json({
      data: await this.service.archive(parseContentId(req.params.id)),
    });
  };
  delete: RequestHandler = async (req, res) => {
    await this.service.delete(parseContentId(req.params.id));
    res.status(204).end();
  };
}
