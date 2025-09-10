const database = require('../config/database');

class ActivityController {
  // Get all activities
  async getAllActivities(req, res) {
    try {
      const db = database.getConnection();
      const { page = 1, limit = 50, todo_id } = req.query;
      const offset = (page - 1) * limit;

      let sql = `
        SELECT 
          a.*,
          t.title as todo_title
        FROM activities a
        LEFT JOIN todos t ON a.todo_id = t.id
      `;
      let params = [];

      if (todo_id) {
        sql += ' WHERE a.todo_id = ?';
        params.push(todo_id);
      }

      sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      db.all(sql, params, (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        // Get total count for pagination
        let countSql = 'SELECT COUNT(*) as total FROM activities';
        let countParams = [];
        
        if (todo_id) {
          countSql += ' WHERE todo_id = ?';
          countParams.push(todo_id);
        }

        db.get(countSql, countParams, (err, countResult) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          res.json({
            activities: rows,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: countResult.total,
              pages: Math.ceil(countResult.total / limit)
            }
          });
        });
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get activities for a specific todo
  async getActivitiesByTodoId(req, res) {
    try {
      const { todoId } = req.params;
      const db = database.getConnection();

      const sql = `
        SELECT 
          a.*,
          t.title as todo_title
        FROM activities a
        LEFT JOIN todos t ON a.todo_id = t.id
        WHERE a.todo_id = ?
        ORDER BY a.created_at DESC
      `;

      db.all(sql, [todoId], (err, rows) => {
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

  // Get a single activity by id
  async getActivityById(req, res) {
    try {
      const { id } = req.params;
      const db = database.getConnection();

      const sql = `
        SELECT 
          a.*,
          t.title as todo_title
        FROM activities a
        LEFT JOIN todos t ON a.todo_id = t.id
        WHERE a.id = ?
      `;

      db.get(sql, [id], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (!row) {
          res.status(404).json({ error: 'Activity not found' });
          return;
        }
        res.json(row);
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Create a new activity (usually called internally)
  async createActivity(activityData) {
    return new Promise((resolve, reject) => {
      const db = database.getConnection();
      const {
        todo_id,
        action,
        description,
        old_value,
        new_value,
        user_ip,
        user_agent
      } = activityData;

      const sql = `
        INSERT INTO activities (
          todo_id, action, description, old_value, new_value, user_ip, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(sql, [
        todo_id,
        action,
        description,
        old_value,
        new_value,
        user_ip,
        user_agent
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  // Delete an activity
  async deleteActivity(req, res) {
    try {
      const { id } = req.params;
      const db = database.getConnection();

      db.run('DELETE FROM activities WHERE id = ?', [id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (this.changes === 0) {
          res.status(404).json({ error: 'Activity not found' });
          return;
        }
        res.json({ message: 'Activity deleted successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Clear all activities (admin function)
  async clearAllActivities(req, res) {
    try {
      const db = database.getConnection();

      db.run('DELETE FROM activities', function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ 
          message: 'All activities cleared successfully',
          deletedCount: this.changes
        });
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get activity statistics
  async getActivityStats(req, res) {
    try {
      const db = database.getConnection();

      const statsQueries = [
        'SELECT COUNT(*) as total FROM activities',
        'SELECT COUNT(*) as today FROM activities WHERE DATE(created_at) = DATE("now")',
        'SELECT action, COUNT(*) as count FROM activities GROUP BY action',
        'SELECT DATE(created_at) as date, COUNT(*) as count FROM activities GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 7'
      ];

      Promise.all(statsQueries.map(query => 
        new Promise((resolve, reject) => {
          db.all(query, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        })
      )).then(([total, today, byAction, byDate]) => {
        res.json({
          total: total[0].total,
          today: today[0].today,
          byAction: byAction,
          last7Days: byDate
        });
      }).catch(err => {
        res.status(500).json({ error: err.message });
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new ActivityController();
