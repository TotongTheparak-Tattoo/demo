const { Connection, Request } = require('tedious');

const config = {
  server: process.env.DB_HOST || 'db',
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USERNAME || 'sa',
      password: process.env.DB_PASSWORD || 'YourStrong@Passw0rd',
    }
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    database: 'master' // Connect to master database first
  }
};

const createDatabase = () => {
  return new Promise((resolve, reject) => {
    const connection = new Connection(config);
    
    connection.on('connect', (err) => {
      if (err) {
        console.error('Connection error:', err);
        reject(err);
        return;
      }
      
      console.log('Connected to SQL Server');
      const dbName = process.env.DB_DATABASE || 'wms_db';
      
      const request = new Request(
        `IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${dbName}') CREATE DATABASE [${dbName}]`,
        (err) => {
          if (err) {
            console.error('Error creating database:', err);
            reject(err);
          } else {
            console.log(`Database '${dbName}' is ready`);
            resolve();
          }
          connection.close();
        }
      );
      
      connection.execSql(request);
    });
    
    connection.on('error', (err) => {
      console.error('Connection error:', err);
      reject(err);
    });
    
    connection.connect();
  });
};

// Wait for database and create if needed
const waitForDatabase = async () => {
  const maxRetries = 30;
  const retryDelay = 2000; // 2 seconds
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await createDatabase();
      console.log('Database initialization complete');
      process.exit(0);
    } catch (err) {
      if (i < maxRetries - 1) {
        console.log(`Waiting for SQL Server... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error('Failed to initialize database after retries:', err);
        process.exit(1);
      }
    }
  }
};

waitForDatabase();

