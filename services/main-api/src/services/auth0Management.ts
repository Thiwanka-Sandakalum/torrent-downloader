import {
  GetUsers200ResponseOneOfInnerAppMetadata,
  ManagementClient,
} from "auth0";
import { AuthMetadata, EncryptedMetadata } from "../types";
import { EncryptionService } from "../utils/encryption";

class Auth0ManagementService {
  private static instance: Auth0ManagementService;
  private management: ManagementClient;
  private encryption: EncryptionService;

  private constructor() {
    const domain = process.env.AUTH0_DOMAIN!;

    if (
      !domain ||
      !process.env.AUTH0_MGMT_CLIENT_ID ||
      !process.env.AUTH0_MGMT_CLIENT_SECRET
    ) {
      throw new Error("Required Auth0 environment variables are not set");
    }

    this.management = new ManagementClient({
      domain,
      clientId: process.env.AUTH0_MGMT_CLIENT_ID,
      clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET,
      audience: `https://${domain}/api/v2/`,
    });

    this.encryption = new EncryptionService();
  }

  public static getInstance(): Auth0ManagementService {
    if (!Auth0ManagementService.instance) {
      Auth0ManagementService.instance = new Auth0ManagementService();
    }
    return Auth0ManagementService.instance;
  }

  private encryptMetadata(metadata: AuthMetadata): EncryptedMetadata {
    return {
      encryptedData: this.encryption.encrypt(JSON.stringify(metadata)),
      timestamp: new Date().toISOString(),
      version: "1.0",
    };
  }

  private decryptMetadata(
    encryptedMetadata: GetUsers200ResponseOneOfInnerAppMetadata
  ): AuthMetadata {
    try {
      const decryptedString = this.encryption.decrypt(
        encryptedMetadata.encryptedData
      );
      return JSON.parse(decryptedString);
    } catch (error: any) {
      throw new Error(`Failed to decrypt metadata: ${error.message}`);
    }
  }

  async getUserMetadata(userId: string): Promise<AuthMetadata> {
    try {
      const user = await this.management.users.get({ id: userId });
      const encryptedMetadata = user.data.app_metadata;

      if (!encryptedMetadata?.encryptedData) {
        return {};
      }

      return this.decryptMetadata(encryptedMetadata);
    } catch (error: any) {
      throw new Error(`Failed to get user metadata: ${error.message}`);
    }
  }

  async updateUserMetadata(
    userId: string,
    metadata: AuthMetadata
  ): Promise<void> {
    try {
      const encryptedMetadata = this.encryptMetadata(metadata);
      await this.management.users.update(
        { id: userId },
        {
          app_metadata: encryptedMetadata,
        }
      );
    } catch (error: any) {
      console.log(error);
      throw new Error(`Failed to update user metadata: ${error.message}`);
    }
  }

  async getUsers(params = {}): Promise<any[]> {
    try {
      const users = await this.management.users.getAll(params);
      return users.data.map((user) => ({
        ...user,
        app_metadata: user.app_metadata
          ? this.decryptMetadata(
              user.app_metadata as GetUsers200ResponseOneOfInnerAppMetadata
            )
          : {},
      }));
    } catch (error: any) {
      throw new Error(`Failed to get users: ${error.message}`);
    }
  }
}

export default Auth0ManagementService;
