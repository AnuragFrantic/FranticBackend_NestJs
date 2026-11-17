// Returns the MongoDB connection string.
// - MONGODB_URI set (e.g. MongoDB Atlas) -> use it
// - not set -> start a temporary in-memory MongoDB for local development
let memoryServer: { getUri(): string; stop(): Promise<boolean> } | undefined;

export async function getMongoUri(): Promise<string> {
  const uri = process.env.MONGODB_URI?.trim();
  if (uri) return uri;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI is required in production');
  }

  console.warn('MONGODB_URI not set — starting a temporary in-memory MongoDB (data is lost on restart).');
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create({ instance: { dbName: 'frantic' } });
  return memoryServer.getUri();
}
