// services/googleDrive.ts
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import Auth0ManagementService from "./auth0Management";

export const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export const createDriveClient = (accessToken: string) => {
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth: oauth2Client });
};

export class GoogleDriveService {
  constructor(
    private readonly oauth2Client: OAuth2Client,
    private readonly auth0Management: Auth0ManagementService
  ) {}

  async linkGoogleDrive(userId: string, code: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);

    console.log(tokens);

    Auth0ManagementService.getInstance().updateUserMetadata(userId, { tokens });

    // await this.auth0Management.updateUserMetadata(userId, {
    //   googleDriveTokens: tokens,
    // });
  }
}
