const database = require('../config/database');

class TodoController {
  // Get all todos
  async getAllTodos(req, res) {
    try {
      const db = database.getConnection();
      
      db.all('SELECT * FROM todos ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(rows);
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get a single todo by id
  async getTodoById(req, res) {
    try {
      const { id } = req.params;
      const db = database.getConnection();
      
      db.get('SELECT * FROM todos WHERE id = ?', [id], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (!row) {
          res.status(404).json({ error: 'Todo not found' });
          return;
        }
        res.json(row);
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Create a new todo
  async createTodo(req, res) {
    try {
      const { title, description } = req.body;
      
      // Validation
      if (!title || title.trim() === '') {
        res.status(400).json({ error: 'Title is required' });
        return;
      }

      const db = database.getConnection();
      
      db.run(
        'INSERT INTO todos (title, description) VALUES (?, ?)',
        [title.trim(), description ? description.trim() : ''],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.status(201).json({
            id: this.lastID,
            title: title.trim(),
            description: description ? description.trim() : '',
            completed: false,
            message: 'Todo created successfully'
          });
        }
      );
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
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
