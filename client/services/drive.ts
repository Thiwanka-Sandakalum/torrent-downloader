import { apiClient } from './api';

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    webViewLink: string;
    createdTime: string;
}

export const linkGoogleDrive = async (code: string): Promise<{ driveLinked: boolean }> => {
    const { data } = await apiClient.post<{ driveLinked: boolean }>('/drive/link-google-drive', { code });
    return data;
};

export const listDriveFiles = async (): Promise<DriveFile[]> => {
    const { data } = await apiClient.get<DriveFile[]>('/drive/files');
    return data;
};
