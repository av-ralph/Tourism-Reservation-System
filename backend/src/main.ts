import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureCors } from './cors.js';
async function bootstrap(){
 const app=await NestFactory.create(AppModule);
 configureCors(app);
 app.enableShutdownHooks();
 await app.listen(process.env.PORT??3001,process.env.VERCEL?'0.0.0.0':'127.0.0.1');
}
// Let Vercel finish importing the entrypoint while it starts the server.
void bootstrap();
