import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { AppError } from '../shared/errors/app-error.js';

export const validate = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as any;
      
      req.body = parsed.body;
      // Express 5 exposes req.query as a getter only, so it cannot be assigned directly
      Object.defineProperty(req, 'query', {
        value: parsed.query,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      req.params = parsed.params;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues
          .map((err) => `${err.path.join('.')} - ${err.message}`)
          .join(', ');
        next(new AppError(errorMessages, 400));
        return;
      }
      next(error);
    }
  };
};
