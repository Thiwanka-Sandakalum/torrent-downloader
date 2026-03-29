import mongoose, { Schema } from 'mongoose';

const taskSchema = new Schema({
    taskId: {
        type: String,
        required: true,
        unique: true,
    },
    userId: {
        type: String,
        required: true,
        index: true,
    },
    magnetLink: {
        type: String,
        required: true,
        maxlength: 1024,
    },
    status: {
        type: String,
        enum: ['queued', 'downloading', 'uploading', 'complete', 'failed', 'cancelled'],
        default: 'queued',
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    speed: String,
    eta: Number,
    storagePath: String,
    driveFileId: String,
    errorMessage: String,
    createdAt: {
        type: Date,
        default: () => new Date(),
    },
    completedAt: Date,
});

// Compound index
taskSchema.index({ userId: 1, createdAt: -1 });

export const TaskModel = mongoose.model('Task', taskSchema);
