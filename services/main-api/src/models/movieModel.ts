import mongoose, { Schema } from 'mongoose';

const movieSchema = new Schema({
    tmdbId: {
        type: Number,
        required: true,
        unique: true,
    },
    title: {
        type: String,
        required: true,
    },
    year: Number,
    rating: Number,
    posterUrl: String,
    overview: String,
    cachedAt: {
        type: Date,
        default: () => new Date(),
    },
});

export const MovieModel = mongoose.model('Movie', movieSchema);
