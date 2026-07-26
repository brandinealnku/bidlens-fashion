# Deployment

Set the variables in `.env.example`, use hosted PostgreSQL/Supabase with an adapted Prisma provider for production, run migrations, then deploy to Vercel or build the Docker image. Configure email authentication and server-side session mapping before disabling demo mode. Keep Gemini/OpenAI/eBay/service-role keys server-only. The bundled Compose profile persists the demo SQLite database.
