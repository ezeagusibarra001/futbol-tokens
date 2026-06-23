import mongoose from 'mongoose';
import { mongooseMetricsPlugin } from './mongoose-metrics.plugin';

mongoose.plugin(mongooseMetricsPlugin);
