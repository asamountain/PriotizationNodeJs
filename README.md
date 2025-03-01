# Priority Task Manager

A modern web application for managing tasks using the Eisenhower Matrix principle, built with Vue.js, D3.js, and SQLite.

## Features

- Interactive task management interface
- Real-time updates using Socket.IO
- Visual task prioritization using D3.js charts
- Persistent storage with SQLite database
- Responsive and modern UI design

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation

1. Clone the repository:
```bash
git clone [your-repo-url]
cd priority-task-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
node server.js
```

4. Open your browser and navigate to:
```
http://localhost:3002
```

## Usage

1. **Adding Tasks**
   - Enter task name
   - Set importance (0-10)
   - Set urgency (0-10)
   - Click "Add Task"

2. **Managing Tasks**
   - View tasks in the priority matrix chart
   - Mark tasks as done/undone
   - Tasks are automatically categorized into quadrants:
     - Q1: Do First (High Urgency, High Importance)
     - Q2: Schedule (Low Urgency, High Importance)
     - Q3: Delegate (High Urgency, Low Importance)
     - Q4: Don't Do (Low Urgency, Low Importance)

## Tech Stack

- Frontend: Vue.js 3
- Visualization: D3.js
- Backend: Node.js, Express
- Database: SQLite
- Real-time: Socket.IO

## Project Structure

```
priority-task-app/
├── public/
│   ├── index.html
│   ├── style.css
│   └── taskManager.js
├── server.js
├── db.js
├── socket.js
└── logger.js
```

## License

MIT License 