import type { INestApplication } from '@nestjs/common';

export function configureCors(app: INestApplication) {
  const configured = process.env.CORS_ORIGINS || 'https://hmreservation.netlify.app';
  const origins = configured.split(',').map(origin => origin.trim()).filter(Boolean);
  if (!process.env.VERCEL) origins.push('http://127.0.0.1:5174', 'http://localhost:5174');
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Session'],
    credentials: false,
    maxAge: 600,
  });
}
