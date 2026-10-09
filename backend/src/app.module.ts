import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RecordStore } from './record-store.js';
@Module({
 imports:[ConfigModule.forRoot({isGlobal:true})],
 controllers:[AppController],
 providers:[RecordStore,AppService],
})
export class AppModule {}
