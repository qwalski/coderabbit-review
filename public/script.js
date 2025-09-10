class TodoApp {
    constructor() {
        this.todos = [];
        this.currentFilter = 'all';
        this.editingTodoId = null;
        
        this.initializeEventListeners();
        this.loadTodos();
    }

    initializeEventListeners() {
        // Form submission
        document.getElementById('todoForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTodo();
        });

        // Edit form submission
        document.getElementById('editForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateTodo();
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        // Modal close events
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('editModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    async loadTodos() {
        try {
            const response = await fetch('/api/todos');
            if (!response.ok) {
                throw new Error('Failed to load todos');
            }
            this.todos = await response.json();
            this.renderTodos();
            this.updateStats();
        } catch (error) {
            console.error('Error loading todos:', error);
            this.showError('Failed to load todos');
        }
    }

    async addTodo() {
        const titleInput = document.getElementById('todoTitle');
        const descriptionInput = document.getElementById('todoDescription');
        
        const title = titleInput.value.trim();
        const description = descriptionInput.value.trim();

        if (!title) {
            this.showError('Please enter a todo title');
            return;
        }

        try {
            const response = await fetch('/api/todos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, description }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add todo');
            }

            const newTodo = await response.json();
            this.todos.unshift(newTodo);
            this.renderTodos();
            this.updateStats();
            
            // Clear form
            titleInput.value = '';
            descriptionInput.value = '';
            
            this.showSuccess('Todo added successfully!');
        } catch (error) {
            console.error('Error adding todo:', error);
            this.showError(error.message);
        }
    }

    async updateTodo() {
        if (!this.editingTodoId) return;

        const title = document.getElementById('editTitle').value.trim();
        const description = document.getElementById('editDescription').value.trim();
        const completed = document.getElementById('editCompleted').checked;

        if (!title) {
            this.showError('Please enter a todo title');
            return;
        }

        try {
            const response = await fetch(`/api/todos/${this.editingTodoId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, description, completed }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update todo');
            }

            // Update local todos array
            const todoIndex = this.todos.findIndex(todo => todo.id === this.editingTodoId);
            if (todoIndex !== -1) {
                this.todos[todoIndex] = {
                    ...this.todos[todoIndex],
                    title,
                    description,
                    completed
                };
            }

            this.renderTodos();
            this.updateStats();
            this.closeModal();
            this.showSuccess('Todo updated successfully!');
        } catch (error) {
            console.error('Error updating todo:', error);
            this.showError(error.message);
        }
    }

    async deleteTodo(id) {
        if (!confirm('Are you sure you want to delete this todo?')) {
            return;
        }

        try {
            const response = await fetch(`/api/todos/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete todo');
            }

            // Remove from local todos array
            this.todos = this.todos.filter(todo => todo.id !== id);
            this.renderTodos();
            this.updateStats();
            this.showSuccess('Todo deleted successfully!');
        } catch (error) {
            console.error('Error deleting todo:', error);
            this.showError(error.message);
        }
    }

    async toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (!todo) return;

        try {
            const response = await fetch(`/api/todos/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ completed: !todo.completed }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update todo');
            }

            // Update local todos array
            todo.completed = !todo.completed;
            this.renderTodos();
            this.updateStats();
        } catch (error) {
            console.error('Error toggling todo:', error);
            this.showError(error.message);
        }
    }

    editTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (!todo) return;

        this.editingTodoId = id;
        document.getElementById('editTitle').value = todo.title;
        document.getElementById('editDescription').value = todo.description || '';
        document.getElementById('editCompleted').checked = todo.completed;
        
        document.getElementById('editModal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('editModal').style.display = 'none';
        this.editingTodoId = null;
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        this.renderTodos();
    }

    getFilteredTodos() {
        switch (this.currentFilter) {
            case 'completed':
                return this.todos.filter(todo => todo.completed);
            case 'pending':
                return this.todos.filter(todo => !todo.completed);
            default:
                return this.todos;
        }
    }

    renderTodos() {
        const todosList = document.getElementById('todosList');
        const noTodos = document.getElementById('noTodos');
        const filteredTodos = this.getFilteredTodos();

        if (filteredTodos.length === 0) {
            todosList.style.display = 'none';
            noTodos.style.display = 'block';
            return;
        }

        todosList.style.display = 'block';
        noTodos.style.display = 'none';

        todosList.innerHTML = filteredTodos.map(todo => `
            <div class="todo-item ${todo.completed ? 'completed' : ''}">
                <div class="todo-header">
                    <h3 class="todo-title">${this.escapeHtml(todo.title)}</h3>
                    <div class="todo-actions">
                        <button class="btn btn-success" onclick="todoApp.toggleTodo(${todo.id})">
                            ${todo.completed ? 'Undo' : 'Complete'}
                        </button>
                        <button class="btn btn-secondary" onclick="todoApp.editTodo(${todo.id})">
                            Edit
                        </button>
                        <button class="btn btn-danger" onclick="todoApp.deleteTodo(${todo.id})">
                            Delete
                        </button>
                    </div>
                </div>
                ${todo.description ? `<p class="todo-description">${this.escapeHtml(todo.description)}</p>` : ''}
                <div class="todo-meta">
                    <span class="todo-date">Created: ${this.formatDate(todo.created_at)}</span>
                    <span class="todo-status">${todo.completed ? '✅ Completed' : '⏳ Pending'}</span>
                </div>
            </div>
        `).join('');
    }

    updateStats() {
        const total = this.todos.length;
        const completed = this.todos.filter(todo => todo.completed).length;
        const pending = total - completed;

        document.getElementById('totalTodos').textContent = `Total: ${total}`;
        document.getElementById('completedTodos').textContent = `Completed: ${completed}`;
        document.getElementById('pendingTodos').textContent = `Pending: ${pending}`;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type) {
        // Remove existing notifications
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;

        if (type === 'error') {
            notification.style.background = '#dc3545';
        } else {
            notification.style.background = '#28a745';
        }

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 3000);
    }
}

// Initialize the app when the page loads
let todoApp;
document.addEventListener('DOMContentLoaded', () => {
    todoApp = new TodoApp();
});
