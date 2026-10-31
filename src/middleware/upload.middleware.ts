import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../shared/errors/app-error.js';

const MAX_IMAGE_SIZE_MB = 5;

const singleImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024, files: 1 },
}).single('image');

export const uploadImage = (req: Request, res: Response, next: NextFunction): void => {
  singleImage(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(
        new AppError(
          error.code === 'LIMIT_FILE_SIZE'
            ? `Images can be up to ${MAX_IMAGE_SIZE_MB} MB`
            : 'Send one image in the "image" field',
          400
        )
      );
      return;
    }
    next(error);
  });
};
