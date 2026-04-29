# Smart Data Chatbot Dashboard

A complete, production-ready web application with a chatbot interface, KPI dashboard, data management system, and PDF report generator.

## Quick Start

### 1. Start the Backend
```bash
cd backend
npm install
npm start        # Runs on http://localhost:5000
```

### 2. Start the Frontend
```bash
cd frontend
npm install
npm start        # Runs on http://localhost:3000
```

### 3. Login
Open http://localhost:3000 and use one of these demo accounts:

| Username  | Password   | Role    | Access                     |
|-----------|------------|---------|----------------------------|
| admin     | password   | Admin   | Full access to everything  |
| manager   | password   | Manager | Data editing + Reports     |
| viewer    | password   | Viewer  | Dashboard, Chat, Reports   |

## Features

### Dashboard (KPI + Charts)
- Resource utilization metrics
- Bench count and employee stats
- Project status breakdown (Bar, Pie, Line charts)
- Budget vs. Spent analysis

### Chatbot
- Natural language queries ("show bench employees", "active projects", "budget overview")
- Returns data as formatted tables
- Keyword search with AI API plug-in ready (Claude / OpenAI)

### Data Manager (Admin/Manager only)
- View data in sortable tables
- Inline editing
- Add/delete records
- Multi-field filtering + search
- Saves back to JSON files

### Reports
- Bench Report, Resource Summary, Project Overview
- Filter before generating
- Downloads as professional PDF
- Report history with re-download

### Authentication & Roles
- JWT-based login system
- Role-based access control (admin, manager, viewer)
- Protected routes

## Connecting Live AI

Edit `backend/.env` and set:
```
AI_PROVIDER=claude
CLAUDE_API_KEY=your-api-key-here
```
Then install the SDK:
```bash
cd backend
npm install @anthropic-ai/sdk
```
The chatbot will automatically switch from keyword search to Claude API.

## Project Structure
```
smart-dashboard/
├── backend/
│   ├── server.js              # Express server entry point
│   ├── .env                   # Environment config
│   ├── package.json
│   ├── data/                  # JSON data files
│   │   ├── users.json
│   │   ├── projects.json
│   │   └── employees.json
│   ├── middleware/
│   │   └── auth.js            # JWT auth + role checking
│   ├── modules/
│   │   ├── chatbot.js         # NLP + AI integration
│   │   ├── dataHandler.js     # JSON file read/write
│   │   ├── filter.js          # Advanced filtering
│   │   └── pdfGenerator.js    # PDF report creation
│   └── routes/
│       ├── auth.js            # Login/register endpoints
│       ├── chat.js            # Chatbot endpoint
│       ├── data.js            # CRUD data endpoints
│       └── reports.js         # Report generation endpoints
└── frontend/
    ├── public/index.html
    ├── package.json
    └── src/
        ├── App.js             # Routes + layout
        ├── index.js
        ├── context/
        │   └── AuthContext.js  # Auth state management
        ├── components/
        │   └── Sidebar.js     # Navigation sidebar
        ├── pages/
        │   ├── LoginPage.js
        │   ├── DashboardPage.js
        │   ├── ChatbotPage.js
        │   ├── DataManagementPage.js
        │   └── ReportsPage.js
        └── utils/
            └── api.js         # Axios instance with auth
```

## API Endpoints

| Method | Endpoint                        | Auth     | Description               |
|--------|---------------------------------|----------|---------------------------|
| POST   | /api/auth/login                 | No       | Login, get JWT token      |
| POST   | /api/auth/register              | Admin    | Create new user           |
| GET    | /api/auth/me                    | Yes      | Get current user info     |
| GET    | /api/data/files                 | Yes      | List data files           |
| GET    | /api/data/:file                 | Yes      | Read data (with filters)  |
| POST   | /api/data/:file                 | Admin/Mgr| Save updated data         |
| POST   | /api/chat                       | Yes      | Send chatbot message      |
| POST   | /api/reports/generate           | Yes      | Generate PDF report       |
| GET    | /api/reports/list               | Yes      | List generated reports    |

## Adding New Data Files

1. Create a new `.json` file in `backend/data/` (e.g., `clients.json`)
2. Structure it as an array of objects with an `id` field
3. It will automatically appear in the Data Manager

## Tech Stack
- **Frontend**: React 18, Tailwind CSS, Chart.js, React Router
- **Backend**: Node.js, Express, JWT, bcrypt, PDFKit
