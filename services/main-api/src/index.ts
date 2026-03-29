import express from './mainApi/node_modules/@types/express';
import bodyParser from './mainApi/node_modules/@types/body-parser';
import { getPopularMovies, searchMovies, getMovie, downloadMovie, getDownloadedMovies, deleteDownloadedMovies, getDownloadedMovie, deleteDownloadedMovie, streamMovie, checkStatus, cancelTask } from './controllers';

const app = express();
const port = process.env.PORT || 3000;
// const openApiDocument = YAML.load('/home/thiwa/Documents/projects/torrent-hunt/types/openApi.yaml');

app.use(bodyParser.json());
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

// Movies routes
app.get('/movies', getPopularMovies);
app.get('/movies/search', searchMovies);
app.get('/movies/:id', getMovie);

// Downloads routes
app.post('/movies/download', downloadMovie);
app.get('/movies/downloads', getDownloadedMovies);
app.delete('/movies/downloads', deleteDownloadedMovies);
app.get('/movies/downloads/:id', getDownloadedMovie);
app.delete('/movies/downloads/:id', deleteDownloadedMovie);

// Streaming route
app.get('/movies/stream/:id', streamMovie);

// Status routes
app.get('/status/:id', checkStatus);
app.post('/status/:id', cancelTask);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
