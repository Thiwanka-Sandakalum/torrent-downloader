import { Request } from "express";

export interface LinkDriveRequest extends Request {
  body: {
    code: string;
  };
}
