import "express";

declare global {
  namespace Express {
    // adiciona os campos do multer ao Request
    interface Request {
      file?: Express.Multer.File;
      files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
      user?: { id: string; token: string }; // setado pelo authMiddleware
    }
  }
}

export {};
