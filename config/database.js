const sqlite3 = require('sqlite3').verbose();

class Database {
  constructor() {
    this.db = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database('./todos.db', (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.initializeTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  }

  initializeTables() {
    return new Promise((resolve, reject) => {
      const createTodosTableSQL = `
        CREATE TABLE IF NOT EXISTS todos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          completed BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createActivityTableSQL = `
        CREATE TABLE IF NOT EXISTS activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          todo_id INTEGER,
          action TEXT NOT NULL,
          description TEXT,
          old_value TEXT,
          new_value TEXT,
          user_ip TEXT,
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (todo_id) REFERENCES todos (id) ON DELETE SET NULL
        )
      `;

      // Create todos table
      this.db.run(createTodosTableSQL, (err) => {
        if (err) {
          console.error('Error creating todos table:', err.message);
          reject(err);
          return;
        }
        console.log('Todos table ready');

        // Create activities table
        this.db.run(createActivityTableSQL, (err) => {
          if (err) {
            console.error('Error creating activities table:', err.message);
            reject(err);
            return;
          }
          console.log('Activities table ready');
          resolve();
        });
      });
    });
  }

  getConnection() {
    return this.db;
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err.message);
            reject(err);
          } else {
            console.log('Database connection closed.');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

// Create a singleton instance
const database = new Database();

module.exports = database;
