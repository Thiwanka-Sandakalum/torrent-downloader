import express, { NextFunction, Request, Response } from "express";
import { GoogleDriveService, oauth2Client } from "../services/googleDrive";
import { auth0Middleware } from "../middlewares";
import Auth0ManagementService from "../services/auth0Management";
import { LinkDriveRequest } from "../types";

const router = express.Router();

const googleDriveService = new GoogleDriveService(
  oauth2Client,
  Auth0ManagementService.getInstance()
);

router.post(
  "/link-google-drive",
  auth0Middleware,
  async (
    req: LinkDriveRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.auth!.payload.sub;
      const { code } = req.body;

      console.log(userId, code);

      if (userId && code)
        await googleDriveService.linkGoogleDrive(userId, code);

      res.status(200).json({
        success: true,
        message: "Google Drive linked successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
