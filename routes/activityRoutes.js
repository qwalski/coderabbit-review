const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');

// GET /api/activities - Get all activities with pagination
router.get('/', activityController.getAllActivities);

// GET /api/activities/stats - Get activity statistics
router.get('/stats', activityController.getActivityStats);

// GET /api/activities/todo/:todoId - Get activities for a specific todo
router.get('/todo/:todoId', activityController.getActivitiesByTodoId);

// GET /api/activities/:id - Get a single activity by id
router.get('/:id', activityController.getActivityById);

// DELETE /api/activities/:id - Delete a specific activity
router.delete('/:id', activityController.deleteActivity);

// DELETE /api/activities - Clear all activities (admin function)
router.delete('/', activityController.clearAllActivities);

module.exports = router;
