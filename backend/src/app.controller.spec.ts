import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RecordStore } from './record-store.js';
describe('AppController',()=>{
 it('returns the service name',async()=>{
  const module:TestingModule=await Test.createTestingModule({controllers:[AppController],providers:[AppService,RecordStore]}).compile();
  expect(module.get(AppController).getHello()).toBe('HM Laboratory reservation service');
 });
});
