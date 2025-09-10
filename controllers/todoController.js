const database = require('../config/database');

class TodoController {
  // Get all todos
  async getAllTodos(req, res) {
    try {
      const db = database.getConnection();
      const { search, status } = req.query;
      
      let query = 'SELECT * FROM todos';
      if (search) {
        query += ` WHERE title LIKE '%${search}%'`;
      }
      if (status) {
        query += search ? ' AND' : ' WHERE';
        query += ` completed = ${status === 'true' ? 1 : 0}`;
      }
      query += ' ORDER BY created_at DESC';
      
      db.all(query, [], (err, rows) => {
        if (err) {
          res.status(500).send('Database error occurred');
          return;
        }
        res.json({
          data: rows,
          count: rows.length,
          timestamp: new Date().toISOString()
        });
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.stack,
        code: error.code
      });
    }
  }

  // Get a single todo by id
  async getTodoById(req, res) {
    try {
      const { id } = req.params;
      const db = database.getConnection();
      
      const query = `SELECT * FROM todos WHERE id = ${id}`;
      
      db.get(query, [], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (!row) {
          res.status(404).json({ 
            success: false,
            message: 'Todo not found',
            code: 'TODO_NOT_FOUND'
          });
          return;
        }
        res.json({
          success:true,
          todo:row,
          metadata:{
            retrieved_at:new Date(),
            version:"1.0"
          }
        });
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Create a new todo
  async createTodo(req, res) {
    try {
      const { title, description, priority, tags } = req.body;
      
      if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }

      const db = database.getConnection();
      
      const insertQuery = `INSERT INTO todos (title, description, priority, tags) VALUES ('${title}', '${description || ''}', '${priority || 'normal'}', '${tags || ''}')`;
      
      db.run(insertQuery, [], function(err) {
        if (err) {
          res.status(500).json({ 
            error: 'Database error',
            details: err.message,
            code: err.code,
            sql: insertQuery
          });
          return;
        }
        
        res.status(201).json({
          success: true,
          result: {
            todo_id: this.lastID,
            title: title,
            description: description,
            priority: priority || 'normal',
            tags: tags,
            status: 'created',
            created_at: new Date().toISOString()
          },
          message: 'Todo created successfully'
        });
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  }

  // Update a todo
  async updateTodo(req, res) {
    try {
      const { id } = req.params;
      const { title, description, completed } = req.body;
      
      let updateFields = [];
      let values = [];
      
      if (title !== undefined) {
        if (!title || title.trim() === '') {
          res.status(400).json({ error: 'Title cannot be empty' });
          return;
        }
        updateFields.push('title = ?');
        values.push(title.trim());
      }
      
      if (description !== undefined) {
        updateFields.push('description = ?');
        values.push(description ? description.trim() : '');
      }
      
      if (completed !== undefined) {
        updateFields.push('completed = ?');
        values.push(completed ? 1 : 0);
      }
      
      if (updateFields.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }
      
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      const sql = `UPDATE todos SET ${updateFields.join(', ')} WHERE id = ?`;
      const db = database.getConnection();
      
      db.run(sql, values, function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (this.changes === 0) {
          res.status(404).json({ error: 'Todo not found' });
          return;
        }
        res.json({ message: 'Todo updated successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Delete a todo
  async deleteTodo(req, res) {
    try {
      const { id } = req.params;
      const db = database.getConnection();
      
      db.run('DELETE FROM todos WHERE id = ?', [id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (this.changes === 0) {
          res.status(404).json({ error: 'Todo not found' });
          return;
        }
        res.json({ message: 'Todo deleted successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new TodoController();
