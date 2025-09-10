# Todo App

A modern, full-stack todo application built with Node.js, Express, and SQLite. Features a beautiful, responsive frontend with real-time updates and a robust REST API backend.

## Features

- ✅ **CRUD Operations**: Create, read, update, and delete todos
- 🎨 **Modern UI**: Beautiful, responsive design with smooth animations
- 🔍 **Filtering**: Filter todos by status (All, Pending, Completed)
- 📊 **Statistics**: Real-time todo statistics
- 💾 **SQLite Database**: Lightweight, file-based database
- 🚀 **REST API**: Clean, well-documented API endpoints
- 📱 **Mobile Responsive**: Works perfectly on all device sizes
- ⚡ **Real-time Updates**: Instant UI updates without page refresh
- 📝 **Activity Tracking**: Complete audit log of all user actions
- 🔍 **Activity Analytics**: Detailed statistics and activity monitoring

## Tech Stack

### Backend

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **SQLite3** - Database
- **CORS** - Cross-origin resource sharing
- **Body-parser** - Request parsing middleware

### Frontend

- **Vanilla JavaScript** - No frameworks, pure JS
- **CSS3** - Modern styling with gradients and animations
- **HTML5** - Semantic markup

## Installation

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Setup Instructions

1. **Clone or navigate to the project directory**

   ```bash
   cd coderabbit-review
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the application**

   ```bash
   npm start
   ```

   For development with auto-restart:

   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## API Endpoints

### Todos

| Method | Endpoint         | Description         | Request Body                                                           |
| ------ | ---------------- | ------------------- | ---------------------------------------------------------------------- |
| GET    | `/api/todos`     | Get all todos       | -                                                                      |
| GET    | `/api/todos/:id` | Get a specific todo | -                                                                      |
| POST   | `/api/todos`     | Create a new todo   | `{ "title": "string", "description": "string" }`                       |
| PUT    | `/api/todos/:id` | Update a todo       | `{ "title": "string", "description": "string", "completed": boolean }` |
| DELETE | `/api/todos/:id` | Delete a todo       | -                                                                      |

### Activities

| Method | Endpoint                   | Description                | Query Parameters           |
| ------ | -------------------------- | -------------------------- | -------------------------- |
| GET    | `/api/activities`          | Get all activities         | `page`, `limit`, `todo_id` |
| GET    | `/api/activities/stats`    | Get activity statistics    | -                          |
| GET    | `/api/activities/todo/:id` | Get activities for a todo  | -                          |
| GET    | `/api/activities/:id`      | Get a specific activity    | -                          |
| DELETE | `/api/activities/:id`      | Delete a specific activity | -                          |
| DELETE | `/api/activities`          | Clear all activities       | -                          |

### Example API Usage

**Create a new todo:**

```bash
curl -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn Node.js", "description": "Complete the Node.js tutorial"}'
```

**Get all todos:**

```bash
curl http://localhost:3000/api/todos
```

**Update a todo:**

```bash
curl -X PUT http://localhost:3000/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

**Delete a todo:**

```bash
curl -X DELETE http://localhost:3000/api/todos/1
```

**Get all activities:**

```bash
curl http://localhost:3000/api/activities
```

**Get activities with pagination:**

```bash
curl "http://localhost:3000/api/activities?page=1&limit=10"
```

**Get activities for a specific todo:**

```bash
curl http://localhost:3000/api/activities/todo/1
```

**Get activity statistics:**

```bash
curl http://localhost:3000/api/activities/stats
```

## Database Schema

The application uses SQLite with the following schema:

```sql
-- Todos table
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Activities table for audit logging
CREATE TABLE activities (
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
);
```

## Project Structure

```
coderabbit-review/
├── config/                # Configuration files
│   └── database.js       # Database connection and setup
├── controllers/           # Business logic controllers
│   ├── todoController.js # Todo-related controller functions
│   └── activityController.js # Activity tracking controller
├── routes/               # API route definitions
│   ├── todoRoutes.js     # Todo API routes
│   └── activityRoutes.js # Activity API routes
├── public/               # Frontend files
│   ├── index.html        # Main HTML file
│   ├── style.css         # CSS styles
│   └── script.js         # JavaScript functionality
├── server.js             # Main Express server file
├── package.json          # Dependencies and scripts
├── todos.db             # SQLite database (created automatically)
└── README.md            # This file
```

## Features in Detail

### Frontend Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Statistics**: Shows total, completed, and pending todos
- **Filter System**: Filter todos by completion status
- **Modal Editing**: Edit todos in a popup modal
- **Smooth Animations**: CSS transitions and animations
- **Error Handling**: User-friendly error messages
- **Success Notifications**: Confirmation messages for actions

### Backend Features

- **Modular Architecture**: Clean separation of concerns with controllers, routes, and config
- **RESTful API**: Clean, consistent API design
- **Input Validation**: Server-side validation for all inputs
- **Error Handling**: Comprehensive error handling and responses
- **Database Integration**: Automatic database initialization with singleton pattern
- **CORS Support**: Cross-origin requests enabled
- **Graceful Shutdown**: Proper cleanup on server shutdown
- **Async/Await**: Modern JavaScript patterns for better error handling

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon for automatic server restart on file changes.

### Adding New Features

1. Backend changes go in `server.js`
2. Frontend changes go in the `public/` directory
3. Database changes require updating the schema in `server.js`

## Troubleshooting

### Common Issues

**Port already in use:**

```bash
Error: listen EADDRINUSE :::3000
```

Solution: Change the PORT in `server.js` or kill the process using port 3000.

**Database connection issues:**

- Ensure the application has write permissions in the project directory
- Check that SQLite3 is properly installed

**Dependencies not installing:**

```bash
npm cache clean --force
npm install
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Future Enhancements

- [ ] User authentication
- [ ] Categories/tags for todos
- [ ] Due dates and reminders
- [ ] File attachments
- [ ] Search functionality
- [ ] Data export/import
- [ ] Dark mode toggle
- [ ] Keyboard shortcuts
- [ ] Drag and drop reordering
- [ ] Bulk operations

---

**Happy Todo-ing! 🎉**
