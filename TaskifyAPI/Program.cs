using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Data;
using TaskifyAPI.Repositories;
using TaskifyAPI.Repositories.IRepositories;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// Configure JSON serialization to handle enums as strings
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure Entity Framework Core with SQL Server
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Register repositories and Unit of Work
builder.Services.AddScoped<ITaskRepository, TaskRepository>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

// Configure CORS for frontend (Next.js on localhost:3000)
// Configure CORS for frontend (Next.js on localhost:3000)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            // In development, allow any localhost origin
            policy.SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrEmpty(origin)) return false;
                var uri = new Uri(origin);
                return uri.Host == "localhost" || uri.Host == "127.0.0.1";
            });
        }
        else
        {
            // In production, only allow specific origins
            policy.WithOrigins("http://localhost:3000", "http://127.0.0.1:3000");
        }

        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseCors("AllowFrontend");
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Enable CORS - must be before UseAuthorization

app.UseAuthorization();

app.MapControllers();

app.Run();
