import { diskStorage } from 'multer';
import { extname } from 'path';

export const companyLogoMulter = {
  storage: diskStorage({
    destination: './uploads/company',
    filename: (req, file, cb) => {
      const name = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, name + extname(file.originalname));
    },
  }),
};

export const multerConfigBrands = {
  storage: diskStorage({
    destination: './uploads/brands',
    filename: (req, file, callback) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);

      callback(null, `${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 4, // 1 primary + 3 secondary
  },
  fileFilter: (
    req: any,
    file: { mimetype: string },
    cb: (arg0: Error | null, arg1: boolean) => void,
  ) => {
    if (file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
};

export const multerConfigProducts = {
  storage: diskStorage({
    destination: './uploads/products',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      cb(null, `product-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (
    req: any,
    file: { mimetype: string },
    cb: (arg0: Error | null, arg1: boolean) => void,
  ) => {
    if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
};

export const multerConfigHeroBanner = {
  storage: diskStorage({
    destination: './uploads/products',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      cb(null, `product-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (
    req: any,
    file: { mimetype: string },
    cb: (arg0: Error | null, arg1: boolean) => void,
  ) => {
    if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
};
