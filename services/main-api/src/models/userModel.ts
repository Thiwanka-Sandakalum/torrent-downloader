import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema({
    auth0Id: {
        type: String,
        required: true,
        unique: true,
    },
    driveLinked: {
        type: Boolean,
        default: false,
    },
    driveTokens: {
        encryptedAccessToken: String,
        encryptedRefreshToken: String,
        expiryDate: String,
    },
    createdAt: {
        type: Date,
        default: () => new Date(),
    },
    updatedAt: Date,
});

export const UserModel = mongoose.model('User', userSchema);
