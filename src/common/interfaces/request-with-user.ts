import { Request } from 'express';
import { UserDocument } from 'src/users/schema/user.schema';

export  interface RequestWithUser extends Request {
  user: UserDocument;
}

