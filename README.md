# 📋 Taskify

**AI-Powered Task Management System with Intelligent Chat Assistant**

![.NET](https://img.shields.io/badge/.NET-8.0-512BD4?logo=dotnet)
![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)
![Rasa](https://img.shields.io/badge/Rasa-3.x-5A17EE?logo=rasa)

Taskify is a modern, full-stack task management application that combines powerful CRUD operations with AI-powered conversational assistance. Built with cutting-edge technologies, it provides an intuitive interface for managing tasks with multiple views, real-time updates, and intelligent chatbot support powered by Rasa.

---

## ✨ Features

### 🎯 Task Management
- **Complete CRUD Operations**: Create, read, update, and delete tasks with full user ownership
- **Multiple Views**: 
  - 📊 **Dashboard View**: Kanban-style board with drag-and-drop functionality
  - 📝 **List View**: Linear task list with inline editing
  - 📅 **Calendar View**: Month/week view organized by due dates
  - 📑 **Table View**: Sortable data table for advanced filtering
- **Task Organization**:
  - Priority levels: High, Medium, Low
  - Status tracking: Todo, In Progress, Completed
  - Due date management with overdue indicators
  - Rich text descriptions (4000 characters) with TipTap editor
- **Smart Features**:
  - Drag-and-drop task reordering
  - Dynamic grouping by status or priority
  - Real-time statistics and analytics
  - Overdue task highlighting

### 🤖 AI Chat Assistant
- **Natural Language Interaction**: Conversational task creation and management
- **Intelligent Commands**:
  - List overdue tasks with priority sorting
  - Create tasks via natural language
  - Weekly productivity summaries
  - Task prioritization advice
- **Context-Aware Responses**: Personalized based on user's task history
- **Suggested Prompts**: Quick action buttons for common queries

### 🔐 Authentication & Security
- **JWT-Based Authentication**: Secure token-based login system
- **Role-Based Access Control**: Admin and User roles with different permissions
- **User Management**:
  - Registration with email validation
  - Profile management with avatar upload
  - Password change functionality
  - Secure password requirements (6+ chars, digit, uppercase, lowercase)

### 🎨 UI/UX
- **Dark/Light Theme**: Toggle between themes with next-themes
- **Responsive Design**: Fully optimized for mobile, tablet, and desktop
- **Modern UI Components**: Built with Radix UI and Tailwind CSS
- **Real-Time Updates**: Optimistic UI updates with automatic rollback on errors
- **Toast Notifications**: Beautiful notifications with Sonner
- **Rich Text Editor**: TipTap editor for formatted task descriptions

---

## 🛠️ Technology Stack

### Backend (TaskifyAPI)
- **Framework**: ASP.NET Core 8.0
- **Database**: SQL Server with Entity Framework Core 8.0
- **Authentication**: JWT Bearer tokens with ASP.NET Core Identity
- **Architecture**: Repository Pattern with Unit of Work
- **API Documentation**: Swagger/Swashbuckle

**Key Packages**:
- `Microsoft.AspNetCore.Authentication.JwtBearer` (8.0.0)
- `Microsoft.AspNetCore.Identity.EntityFrameworkCore` (8.0.0)
- `Microsoft.EntityFrameworkCore.SqlServer` (8.0.0)
- `Swashbuckle.AspNetCore` (6.6.2)

### Frontend (taskifyView)
- **Framework**: Next.js 16.0.10 with React 19.2.0
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4.1.9
- **UI Components**: Radix UI (comprehensive component library)
- **State Management**: Zustand 5.0.10
- **Form Handling**: React Hook Form 7.60.0 with Zod 3.25.76 validation
- **Rich Text Editor**: TipTap 2.27.2
- **Date Handling**: date-fns 4.1.0
- **Theming**: next-themes 0.4.6
- **Notifications**: Sonner 1.7.4

### AI/Chatbot (Rasa)
- **Framework**: Rasa 3.x
- **Language**: Python 3.8-3.11
- **Action Server**: Rasa SDK with custom Python actions
- **NLU Pipeline**: WhitespaceTokenizer, RegexFeaturizer, DIETClassifier, ResponseSelector
- **Dialogue Management**: TEDPolicy with UnexpecTEDIntentPolicy

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Port 3000)                      │
│                    Next.js Frontend                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Dashboard   │  │   Chat UI    │  │  Auth Pages  │    │
│  │  Components  │  │  AI Assistant│  │  Login/Signup│    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                            │                                 │
│                   Zustand State Management                   │
│                   (auth-store, task-store)                   │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP/REST (JWT Bearer)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              TaskifyAPI (Port 5116/5001)                    │
│              ASP.NET Core 8.0 API                           │
│  ┌───────────┐  ┌───────────┐  ┌────────────┐            │
│  │   Auth    │  │   Task    │  │    Chat    │            │
│  │Controller │  │Controller │  │ Controller │            │
│  └─────┬─────┘  └─────┬─────┘  └──────┬─────┘            │
│        │              │                 │                  │
│        │              │                 │ RasaChatService  │
│        │              │                 │ (HttpClient)     │
│        │              │                 └──────┬───────────│
│        ▼              ▼                        │           │
│  ┌─────────────────────────────┐             │           │
│  │    Entity Framework Core     │             │           │
│  │    ApplicationDbContext      │             │           │
│  │    Repository Pattern        │             │           │
│  └────────────┬─────────────────┘             │           │
│               │                                │           │
│  ┌────────────┴────────────┐                 │           │
│  │  InternalTaskController  │◄────────────────┤           │
│  │  (API Key Protected)     │                 │           │
│  └─────────────────────────┘                 │           │
└────────────────┬──────────────────────────────┼───────────┘
                 │                              │
                 ▼                              ▼
         ┌──────────────┐         ┌──────────────────────┐
         │  SQL Server  │         │  Rasa Server (5005)  │
         │   TaskifyDb  │         │  REST Webhook        │
         └──────────────┘         └──────────┬───────────┘
                                              │
                                              ▼
                                  ┌─────────────────────┐
                                  │ Rasa Action Server  │
                                  │    (Port 5055)      │
                                  │  Custom Actions     │
                                  └──────────┬──────────┘
                                             │
                                             │ HTTP + API Key
                                             ▼
                                  Back to InternalTaskController
```

### Communication Flow

1. **User Authentication**:
   ```
   Frontend → POST /api/Auth/login → JWT Token → localStorage
   All subsequent requests include: Authorization: Bearer {token}
   ```

2. **Task Operations**:
   ```
   Frontend (Zustand) → TaskAPI Controller → EF Core → SQL Server
   Optimistic updates: UI updates immediately, rollback on error
   ```

3. **AI Chat**:
   ```
   Frontend → POST /api/Chat {message}
              → RasaChatService
              → POST http://localhost:5005/webhooks/rest/webhook
              → Rasa NLU/Dialogue Management
              → Custom Action (if needed)
              → POST /api/internal/tasks/{userId} (with X-Rasa-Token)
              → Response chain back to Frontend
   ```

### Port Configuration
- **Frontend**: `http://localhost:3000`
- **TaskifyAPI**: `http://localhost:5116` (or 5001)
- **Rasa Server**: `http://localhost:5005`
- **Rasa Actions**: `http://localhost:5055`

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **.NET 8.0 SDK** - [Download](https://dotnet.microsoft.com/download/dotnet/8.0)
- **Node.js 18+** (with npm or pnpm) - [Download](https://nodejs.org/)
- **SQL Server** (LocalDB or full instance) - [Download](https://www.microsoft.com/en-us/sql-server/sql-server-downloads)
- **Python 3.8-3.11** (Rasa doesn't support 3.12+) - [Download](https://www.python.org/downloads/)
- **Git** - [Download](https://git-scm.com/)

---

## 🚀 Installation

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd Taskify
```

### Step 2: Backend Setup (TaskifyAPI)

1. **Navigate to API directory**:
   ```bash
   cd TaskifyAPI
   ```

2. **Update Database Connection String**:
   
   Edit `appsettings.json` and update the connection string to match your SQL Server instance:
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Server=YOUR_SERVER_NAME;Database=TaskifyDb;Trusted_Connection=True;TrustServerCertificate=True;"
     }
   }
   ```

3. **Apply Database Migrations**:
   ```bash
   dotnet ef database update
   ```
   
   This will:
   - Create the `TaskifyDb` database
   - Apply all 4 migrations (Initial schema, Identity integration, Avatar support, Description expansion)
   - Seed default admin user: `admin@taskify.com` / `Admin@123`
   - Create Admin and User roles

4. **Run the API**:
   ```bash
   dotnet run
   ```
   
   API will be available at:
   - `http://localhost:5116`
   - Swagger UI: `http://localhost:5116/swagger`

### Step 3: Frontend Setup (taskifyView)

1. **Navigate to frontend directory**:
   ```bash
   cd ../taskifyView
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Create environment file**:
   
   Create `.env.local` in the `taskifyView` folder:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5116
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```
   
   Frontend will be available at `http://localhost:3000`

5. **Build for production** (optional):
   ```bash
   npm run build
   npm start
   ```

### Step 4: Rasa Setup (AI Chatbot)

1. **Navigate to Rasa directory**:
   ```bash
   cd ../rasa
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   ```

3. **Activate virtual environment**:
   
   **Windows**:
   ```bash
   venv\Scripts\activate
   ```
   
   **Linux/Mac**:
   ```bash
   source venv/bin/activate
   ```

4. **Install Rasa**:
   ```bash
   pip install rasa
   ```

5. **Install action server dependencies**:
   ```bash
   pip install -r actions/requirements.txt
   ```

6. **Train the model**:
   ```bash
   rasa train
   ```
   
   This creates a trained model in the `rasa/models/` directory.

7. **Run Rasa server** (Terminal 1):
   ```bash
   rasa run --enable-api --cors "*"
   ```
   
   Server runs on `http://localhost:5005`

8. **Run action server** (Terminal 2, new terminal with venv activated):
   ```bash
   rasa run actions
   ```
   
   Actions server runs on `http://localhost:5055`

---

## ⚡ Quick Start (Automated)

For convenience, use the provided batch script to start all services at once:

```bash
./run-all.bat
```

This will open 4 separate terminal windows running:
1. **TaskifyAPI** (Port 5116)
2. **Rasa Server** (Port 5005)
3. **Rasa Actions** (Port 5055)
4. **Frontend** (Port 3000)

**Requirements**:
- All dependencies installed from steps above
- Rasa virtual environment exists at `rasa/venv/`
- SQL Server is running
- Ports 3000, 5001, 5005, 5055 are available

---

## ⚙️ Configuration

### Backend Configuration (`appsettings.json`)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=YOUR_SERVER;Database=TaskifyDb;Trusted_Connection=True;TrustServerCertificate=True;"
  },
  "JwtSettings": {
    "SecretKey": "YourSuperSecretKeyForJWTAuthentication2026!",
    "Issuer": "TaskifyAPI",
    "Audience": "TaskifyClient",
    "ExpirationMinutes": 60
  },
  "Rasa": {
    "BaseUrl": "http://localhost:5005",
    "TimeoutSeconds": 15,
    "ApiKey": "rasa-internal-api-key-taskify-2026"
  }
}
```

**Important**: For production, move sensitive values to environment variables or Azure Key Vault.

### Frontend Configuration (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5116
```

### Rasa Configuration

Key configuration files in the `rasa/` directory:
- **`config.yml`**: NLU pipeline and dialogue policies
- **`domain.yml`**: Intents, entities, actions, and responses
- **`endpoints.yml`**: Action server endpoint configuration
- **`credentials.yml`**: Channel credentials (REST, Socket.IO, etc.)

### Security Notes

Before deploying to production:
- ⚠️ Change JWT `SecretKey` to a strong, unique value
- ⚠️ Update Rasa `ApiKey` for internal API protection
- ⚠️ Configure CORS with specific origins (not wildcard)
- ⚠️ Enable HTTPS and set `RequireHttpsMetadata = true`
- ⚠️ Store sensitive configuration in environment variables

---

## 📖 Usage Guide

### First Login

1. Navigate to `http://localhost:3000`
2. Click **Login**
3. Use the default admin credentials:
   - **Email**: `admin@taskify.com`
   - **Password**: `Admin@123`
4. You can also create a new user account via **Sign Up**

### Managing Tasks

**Create a New Task**:
1. Click the **"+ New Task"** button on the Dashboard
2. Fill in the form:
   - **Title**: Task name (max 200 characters)
   - **Description**: Rich text description (max 4000 characters)
   - **Priority**: High, Medium, or Low
   - **Status**: Todo, In Progress, or Completed
   - **Due Date**: Target completion date
3. Click **Create Task**

**Edit Tasks**:
- Click on any task card to open the edit dialog
- Update fields and save changes
- Use inline editing in List View for quick updates

**Organize Tasks**:
- **Dashboard View**: Drag and drop tasks between columns
- **Filter**: Use the filter dropdown to show specific statuses
- **Sort**: Sort by due date, priority, or status
- **Group**: Toggle between grouping by status or priority

### Using the AI Chat Assistant

1. Click the **Chat** icon in the navigation
2. Type natural language commands, such as:
   - *"List my overdue tasks"*
   - *"Create a task to review the quarterly report"*
   - *"Summarize my week"*
   - *"Help me prioritize my tasks"*
3. Use **Quick Actions** buttons for common queries

**Supported Commands**:
- List tasks (all, overdue, by priority)
- Create tasks via natural language
- Get weekly productivity summaries
- Request task prioritization advice
- General greetings and help

### Profile Management

1. Navigate to **Settings** (user icon in navigation)
2. Update your profile:
   - Upload profile avatar
   - Change password
   - View account information

---

## 📚 API Documentation

### Swagger UI

Interactive API documentation is available at:
```
http://localhost:5116/swagger
```

### Main Endpoints

#### Authentication (`/api/Auth`)
- `POST /api/Auth/register` - Register new user
- `POST /api/Auth/login` - Login and receive JWT token
- `POST /api/Auth/logout` - Logout
- `GET /api/Auth/me` - Get current user info
- `POST /api/Auth/update-profile` - Update profile with avatar
- `POST /api/Auth/change-password` - Change password

#### Tasks (`/api/TaskItem`)
- `GET /api/TaskItem` - List all tasks (filtered by role)
- `GET /api/TaskItem/{id}` - Get task by ID
- `POST /api/TaskItem` - Create new task
- `PUT /api/TaskItem/{id}` - Update task
- `DELETE /api/TaskItem/{id}` - Delete task
- `PATCH /api/TaskItem/{id}/status` - Update status only
- `PATCH /api/TaskItem/{id}/duedate` - Update due date only

#### Chat (`/api/Chat`)
- `POST /api/Chat` - Send message to AI assistant

#### Internal API (`/api/internal/tasks`)
- `GET /api/internal/tasks/{userId}` - List user tasks (Rasa only)
- `POST /api/internal/tasks/{userId}` - Create task for user (Rasa only)

**Note**: All endpoints (except register/login) require JWT Bearer token in the `Authorization` header. Internal endpoints require `X-Rasa-Token` header.

---

## 📁 Project Structure

```
Taskify/
├── TaskifyAPI/                # ASP.NET Core Backend
│   ├── Controllers/           # API Endpoints
│   │   ├── AuthController.cs
│   │   ├── TaskItemController.cs
│   │   ├── ChatController.cs
│   │   └── InternalTaskController.cs
│   ├── Data/                  # DbContext
│   │   └── ApplicationDbContext.cs
│   ├── Model/                 # Entities
│   │   ├── ApplicationUser.cs
│   │   ├── TaskItem.cs
│   │   └── Enums.cs
│   ├── Repositories/          # Data Access Layer
│   │   ├── Repository.cs
│   │   ├── TaskRepository.cs
│   │   └── UnitOfWork.cs
│   ├── Services/              # Business Logic
│   │   ├── IRasaChatService.cs
│   │   └── RasaChatService.cs
│   ├── Migrations/            # EF Core Migrations
│   ├── wwwroot/avatars/       # User avatar uploads
│   └── Program.cs             # Application entry point
├── taskifyView/               # Next.js Frontend
│   ├── app/                   # Pages (App Router)
│   │   ├── page.tsx           # Home page
│   │   ├── login/
│   │   ├── signup/
│   │   ├── account-settings/
│   │   └── globals.css
│   ├── components/            # React Components
│   │   ├── auth/              # Auth components
│   │   ├── dashboard/         # Dashboard UI
│   │   ├── tasks/             # Task views
│   │   │   ├── dashboard-view.tsx
│   │   │   ├── list-view.tsx
│   │   │   ├── calendar-view.tsx
│   │   │   ├── table-view.tsx
│   │   │   └── ai-chat-view.tsx
│   │   └── ui/                # Radix UI components
│   ├── lib/                   # Utilities
│   │   ├── auth-store.ts      # Auth state management
│   │   ├── task-store.ts      # Task state management
│   │   ├── types.ts           # TypeScript types
│   │   └── api/               # API client functions
│   └── public/                # Static assets
├── rasa/                      # AI Chatbot
│   ├── actions/               # Custom Actions (Python)
│   │   ├── actions.py         # Action implementations
│   │   └── requirements.txt
│   ├── data/                  # Training Data
│   │   ├── nlu.yml            # Natural Language Understanding
│   │   ├── stories.yml        # Conversation flows
│   │   └── rules.yml          # Dialogue rules
│   ├── models/                # Trained Models
│   ├── config.yml             # NLU/Dialogue configuration
│   ├── domain.yml             # Intents, actions, responses
│   ├── endpoints.yml          # Server endpoints
│   └── credentials.yml        # Channel credentials
├── run-all.bat                # Startup script for all services
└── README.md                  # This file
```

---

## 🗄️ Database Schema

### Main Entities

#### TaskItem
| Column      | Type         | Description                    |
|-------------|--------------|--------------------------------|
| Id          | int          | Primary key                    |
| Title       | string(200)  | Task title                     |
| Description | string(4000) | Rich text description          |
| Priority    | enum         | Low, Medium, High              |
| Status      | enum         | Todo, InProgress, Completed    |
| DueDate     | DateTime     | Target completion date         |
| CreatedAt   | DateTime     | Creation timestamp             |
| UserId      | string       | Foreign key to ApplicationUser |

#### ApplicationUser (extends IdentityUser)
| Column    | Type   | Description          |
|-----------|--------|----------------------|
| Id        | string | Primary key          |
| UserName  | string | Username             |
| Email     | string | Email address        |
| AvatarUrl | string | Profile picture URL  |

#### AspNetRoles
- **Admin**: Full access to all tasks
- **User**: Access only to own tasks

### Migrations Applied
1. **Initial-Migration**: TaskItems table + seed data
2. **AddIdentityAndUserAuthorization**: ASP.NET Identity tables, roles, admin user
3. **AddAvartarURLToUser**: Avatar URL field
4. **IncreaseDescriptionMaxLength**: Description expanded to 4000 characters

---

## 🤖 Rasa AI Capabilities

### Supported Intents

| Intent              | Description                     | Example Phrases                      |
|---------------------|---------------------------------|--------------------------------------|
| `greet`             | Welcome messages                | "Hello", "Hi", "Hey there"           |
| `goodbye`           | Conversation endings            | "Bye", "See you", "Goodbye"          |
| `ask_howcanhelp`    | Capability inquiry              | "What can you do?", "Help me"        |
| `list_overdue_tasks`| Show overdue tasks              | "List overdue tasks", "What's late?" |
| `summarize_week`    | Weekly productivity summary     | "Summarize my week", "Weekly report" |
| `help_prioritize`   | Task prioritization advice      | "Help me prioritize", "What's urgent?"|
| `create_task`       | Create new task                 | "Create a task to...", "Add task..."  |
| `nlu_fallback`      | Handle unknown inputs           | Automatically triggered              |

### Custom Actions

Implemented in `rasa/actions/actions.py`:

1. **action_list_tasks**
   - Fetches user tasks from TaskifyAPI
   - Displays overdue tasks with ⚠️ indicators
   - Sorts by priority and due date
   - Provides task counts and statistics

2. **action_create_task**
   - Creates tasks via natural language
   - Extracts title from user message
   - Sets default due date (tomorrow)
   - Returns confirmation with task details

3. **action_summarize_week**
   - Provides weekly analytics
   - Shows completed and pending tasks
   - Highlights overdue items
   - Alerts on high-priority tasks
   - Offers productivity tips

### Training the Model

To retrain the model after making changes to intents, actions, or training data:

```bash
cd rasa
rasa train
```

The new model will be saved in `rasa/models/` with a timestamp.

---

## 🐛 Troubleshooting

### Database Connection Issues

**Problem**: Cannot connect to SQL Server

**Solutions**:
- Verify SQL Server is running
- Check connection string in `appsettings.json` matches your server name
- Ensure Windows Authentication is enabled (or update to SQL Auth)
- Try using `(localdb)\\mssqllocaldb` for LocalDB

### Migration Errors

**Problem**: EF Core migration fails

**Solutions**:
```bash
# Delete database and reapply
dotnet ef database drop
dotnet ef database update

# Or create a new migration
dotnet ef migrations add YourMigrationName
dotnet ef database update
```

### Frontend API Connection

**Problem**: Frontend cannot reach API (CORS errors, connection refused)

**Solutions**:
- Verify `NEXT_PUBLIC_API_URL` in `.env.local` is correct
- Ensure TaskifyAPI is running on the specified port
- Check CORS configuration in `Program.cs`
- Clear browser cache and restart dev server

### Rasa Not Responding

**Problem**: AI Chat returns errors or no response

**Solutions**:
- Verify **both** Rasa server AND action server are running
- Check ports 5005 and 5055 are not in use by other applications
- Retrain the model: `rasa train`
- Check action server logs for Python errors
- Verify API key in both `appsettings.json` and Rasa actions match

### 401 Unauthorized Errors

**Problem**: API returns 401 Unauthorized

**Solutions**:
- Token may be expired (default: 60 minutes)
- Logout and login again to get a new token
- Check that `Authorization: Bearer {token}` header is included
- Verify JWT configuration in `appsettings.json`

### CORS Errors

**Problem**: Browser blocks API requests due to CORS policy

**Solutions**:
- Ensure TaskifyAPI is running
- Check CORS policy in `Program.cs` includes your frontend origin
- For development, CORS should allow `http://localhost:3000`
- Restart the API after changing CORS configuration

### Port Already in Use

**Problem**: Cannot start service - port already in use

**Solutions**:
```bash
# Windows - Find and kill process on port 3000 (example)
netstat -ano | findstr :3000
taskkill /PID <process_id> /F

# Or change the port in configuration files
```

---

## 💡 Development Notes

- **TypeScript Errors**: Build errors are ignored in Next.js config (`next.config.mjs`). For production, resolve all TypeScript issues.
- **Rasa Training**: Retrain the model whenever you modify intents, actions, or training data in `rasa/data/`
- **Avatar Storage**: User avatars are stored in `TaskifyAPI/wwwroot/avatars/`. Consider migrating to cloud storage (Azure Blob, AWS S3) for production.
- **Database Seeding**: Default admin user is created during migration. Change the password after first login.
- **JWT Expiration**: Default token expiration is 60 minutes. Adjust in `appsettings.json` based on your requirements.
- **Hot Reload**: Both frontend (Next.js) and Rasa action server support hot reload during development.

---

## 🚢 Production Deployment Checklist

Before deploying to production, complete these tasks:

- [ ] **Security**
  - [ ] Update JWT `SecretKey` to a strong, cryptographically secure value
  - [ ] Change default admin password
  - [ ] Update Rasa API key
  - [ ] Set `RequireHttpsMetadata = true` in JWT configuration
  - [ ] Enable HTTPS/TLS for all services
  
- [ ] **Configuration**
  - [ ] Move sensitive config to environment variables or Azure Key Vault
  - [ ] Configure production CORS origins (remove wildcard)
  - [ ] Update database connection string for production SQL Server
  - [ ] Set `ASPNETCORE_ENVIRONMENT=Production`
  
- [ ] **Infrastructure**
  - [ ] Setup cloud storage for avatar uploads (Azure Blob Storage, AWS S3)
  - [ ] Configure CDN for frontend static assets
  - [ ] Setup application logging (Application Insights, Serilog)
  - [ ] Configure health check endpoints
  - [ ] Setup monitoring and alerting
  
- [ ] **Database**
  - [ ] Backup production database regularly
  - [ ] Review and optimize database indexes
  - [ ] Configure connection pooling
  - [ ] Setup database connection retry policies
  
- [ ] **Build**
  - [ ] Build frontend for production: `npm run build`
  - [ ] Resolve all TypeScript errors
  - [ ] Optimize bundle size (analyze with `npm run build`)
  - [ ] Publish API: `dotnet publish -c Release`
  
- [ ] **Testing**
  - [ ] Perform end-to-end testing
  - [ ] Load testing for API endpoints
  - [ ] Test Rasa chatbot with real scenarios
  - [ ] Verify all authentication flows
  
- [ ] **Deployment**
  - [ ] Consider Docker containerization
  - [ ] Setup CI/CD pipeline (GitHub Actions, Azure DevOps)
  - [ ] Configure reverse proxy (nginx, IIS)
  - [ ] Setup SSL certificates
  - [ ] Document deployment process

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📧 Contact & Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Contact: buiduckhanh285@gmail.com

---

## 🙏 Acknowledgments

- Built with [ASP.NET Core](https://dotnet.microsoft.com/apps/aspnet)
- UI powered by [Next.js](https://nextjs.org/) and [Radix UI](https://www.radix-ui.com/)
- AI capabilities by [Rasa](https://rasa.com/)
- Icons from [Lucide](https://lucide.dev/)

---

**Happy Task Managing! 🎉**
