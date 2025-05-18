import mongoose, { Mongoose } from 'mongoose';

interface GlobalMongoose {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
  var mongoose: GlobalMongoose;
}

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/watchwizards';

if (!global.mongoose) {
  global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (global.mongoose.conn) {
    return global.mongoose.conn;
  }

  if (!global.mongoose.promise) {
    const options = {
      bufferCommands: false,
    };
    global.mongoose.promise = mongoose.connect(MONGODB_URI, options);
  }

  try {
    global.mongoose.conn = await global.mongoose.promise;
    console.log('Connected to MongoDB');
    return global.mongoose.conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
} 