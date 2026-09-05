import mongoose from 'mongoose';
import { env } from './env';

mongoose.set('strictQuery', true);

export async function connectDB(uri: string = env.mongoUri): Promise<typeof mongoose> {
  mongoose.connection.on('connected', () => {
    // eslint-disable-next-line no-console
    console.log(`[db] connected -> ${mongoose.connection.name}`);
  });
  mongoose.connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[db] connection error', err);
  });
  return mongoose.connect(uri);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
