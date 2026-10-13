require('dotenv').config();
const mongoose = require('mongoose');

async function clearDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI not set in environment or .env file');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log(`Connected to database: ${mongoose.connection.name}`);

  const collections = await mongoose.connection.db.collections();
  console.log(`Found ${collections.length} collections:`);

  for (const collection of collections) {
    const count = await collection.countDocuments();
    console.log(` - Clearing '${collection.collectionName}' (${count} documents)...`);
    await collection.deleteMany({});
  }

  await mongoose.disconnect();
  console.log('\nDatabase completely cleared and reset to fresh state!');
}

clearDB().catch(err => {
  console.error('Database reset failed:', err);
  process.exit(1);
});
