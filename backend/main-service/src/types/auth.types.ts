import { Credentials } from "google-auth-library";

export interface GoogleDriveTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface AuthMetadata {
  googleDriveTokens?: Credentials | GoogleDriveTokens;
  preferences?: {
    theme?: string;
    language?: string;
  };
  [key: string]: any;
}

export interface EncryptedMetadata {
  encryptedData: string;
  timestamp: string;
  version: string;
}
