## 2.8.12. Biểu đồ kiến trúc hệ thống

```mermaid
flowchart LR
    User([Người dùng])

    subgraph Client [Tầng giao diện]
        Web[Ứng dụng web Taskify<br/>Next.js 16 / React 19]
        Store[Zustand State Management]
        User --> Web
        Web <--> Store
    end

    subgraph Backend [Tầng dịch vụ ứng dụng]
        Api[TaskifyAPI<br/>ASP.NET Core 8]
        Auth[Auth Controller<br/>JWT Authentication]
        Task[Task / Note / Finance API]
        Chat[Chat Controller]
        Internal[Internal Task Controller<br/>X-Rasa-Token]

        Api --> Auth
        Api --> Task
        Api --> Chat
        Api --> Internal
    end

    subgraph Data [Tầng dữ liệu]
        EF[Entity Framework Core]
        DB[(SQL Server<br/>TaskifyDb)]
        Identity[(ASP.NET Identity)]
        EF <--> DB
        Auth <--> Identity
        Task <--> EF
        Internal <--> EF
    end

    subgraph AI [Tầng trợ lý ảo và NLP]
        Rasa[Rasa Server<br/>Port 5005]
        Action[Rasa Action Server<br/>Port 5055]
        Duckling[Duckling<br/>Port 8000]
        Gemini[Gemini API]
        Ollama[Ollama Fallback]

        Rasa <--> Action
        Rasa <--> Duckling
        Action --> Internal
    end

    Web -->|HTTP/REST + JWT| Api
    Chat -->|Webhook chat| Rasa
    Chat -->|Trích xuất thực thể| Gemini
    Api -->|AI fallback theo cấu hình| Ollama
```

Sơ đồ trên mô tả kiến trúc hệ thống Taskify theo các tầng chính: giao diện người dùng, dịch vụ backend, dữ liệu và khối trợ lý ảo. Kiến trúc này cho phép hệ thống vừa hỗ trợ các chức năng quản lý công việc truyền thống, vừa tích hợp xử lý ngôn ngữ tự nhiên để tạo và cập nhật công việc bằng hội thoại.
