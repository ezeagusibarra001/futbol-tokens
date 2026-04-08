import express from 'express';
import { getRoot } from './controllers/rootController';

const app = express();

app.get('/', getRoot);

export default app;
