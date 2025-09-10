const database = require('../config/database');
const activityController = require('./activityController');

class TodoController {
  // Helper method to log activities
  async logActivity(todoId, action, description, oldValue = null, newValue = null, req = null) {
    try {
      const userIp = req ? req.ip || req.connection.remoteAddress : null;
      const userAgent = req ? req.get('User-Agent') : null;
      
      await activityController.createActivity({
        todo_id: todoId,
        action,
        description,
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null,
        user_ip: userIp,
        user_agent: userAgent
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

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
        async (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          const todoId = this.lastID;
          const newTodo = {
            id: todoId,
            title: title.trim(),
            description: description ? description.trim() : '',
            completed: false
          };

          // Log the creation activity
          await this.logActivity(
            todoId,
            'CREATE',
            `Todo "${title.trim()}" was created`,
            null,
            newTodo,
            req
          );

          res.status(201).json({
            ...newTodo,
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
      const db = database.getConnection();
      
      // First, get the current todo to compare changes
      db.get('SELECT * FROM todos WHERE id = ?', [id], async (err, currentTodo) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (!currentTodo) {
          res.status(404).json({ error: 'Todo not found' });
          return;
        }

        let updateFields = [];
        let values = [];
        let changes = [];
        
        if (title !== undefined) {
          if (!title || title.trim() === '') {
            res.status(400).json({ error: 'Title cannot be empty' });
            return;
          }
          if (title.trim() !== currentTodo.title) {
            updateFields.push('title = ?');
            values.push(title.trim());
            changes.push(`Title changed from "${currentTodo.title}" to "${title.trim()}"`);
          }
        }
        
        if (description !== undefined) {
          const newDescription = description ? description.trim() : '';
          if (newDescription !== (currentTodo.description || '')) {
            updateFields.push('description = ?');
            values.push(newDescription);
            changes.push(`Description changed from "${currentTodo.description || ''}" to "${newDescription}"`);
          }
        }
        
        if (completed !== undefined) {
          const newCompleted = completed ? 1 : 0;
          if (newCompleted !== currentTodo.completed) {
            updateFields.push('completed = ?');
            values.push(newCompleted);
            changes.push(`Status changed from ${currentTodo.completed ? 'completed' : 'pending'} to ${completed ? 'completed' : 'pending'}`);
          }
        }
        
        if (updateFields.length === 0) {
          res.status(400).json({ error: 'No changes detected' });
          return;
        }
        
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        
        const sql = `UPDATE todos SET ${updateFields.join(', ')} WHERE id = ?`;
        
        db.run(sql, values, async (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          // Log the update activity
          await this.logActivity(
            id,
            'UPDATE',
            changes.join(', '),
            currentTodo,
            { ...currentTodo, ...req.body },
            req
          );

          res.json({ message: 'Todo updated successfully' });
        });
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
      
      // First, get the todo to log its details before deletion
      db.get('SELECT * FROM todos WHERE id = ?', [id], async (err, todo) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (!todo) {
          res.status(404).json({ error: 'Todo not found' });
          return;
        }

        // Delete the todo
        db.run('DELETE FROM todos WHERE id = ?', [id], async (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          // Log the deletion activity
          await this.logActivity(
            id,
            'DELETE',
            `Todo "${todo.title}" was deleted`,
            todo,
            null,
            req
          );

          res.json({ message: 'Todo deleted successfully' });
        });
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new TodoController();
