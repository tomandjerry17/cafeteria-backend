import { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: User; // 👈 this allows req.user to exist
    }
  }
}
