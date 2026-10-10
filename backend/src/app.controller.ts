import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { AppService } from './app.service.js';
@Controller()
export class AppController {
 constructor(private readonly appService:AppService){}
 @Get() getHello(){return this.appService.getHello();}
 @Get('api/records') records(@Headers('x-user-session') token?:string){return this.appService.userRecords(token);}
 @Get('api/facilities') facilities(){return this.appService.listFacilities();}
 @Patch('api/admin/facilities/:id') facility(@Param('id') id:string,@Body() body:unknown,@Headers('authorization') key?:string){this.appService.authorizeAdmin(key);return this.appService.updateFacility(id,body);}
 @Get('api/schedule') schedule(){return this.appService.schedule();}
 @Post('api/reservations') reserve(@Body() body:unknown,@Headers('x-user-session') token?:string){return this.appService.createForUser('reservations',body,token);}
 @Post('api/reports') report(@Body() body:unknown,@Headers('x-user-session') token?:string){return this.appService.createForUser('reports',body,token);}
 @Post('api/utilization') utilization(@Body() body:unknown,@Headers('x-user-session') token?:string){return this.appService.createForUser('utilization',body,token);}
 @Delete('api/reservations/:id') cancel(@Param('id') id:string,@Headers('x-user-session') token?:string){return this.appService.cancelForUser(id,token);}
 @Get('api/admin/records') adminRecords(@Headers('authorization') key?:string){this.appService.authorizeAdmin(key);return this.appService.records();}
 @Patch('api/admin/reservations/:id') review(@Param('id') id:string,@Body() body:unknown,@Headers('authorization') key?:string){this.appService.authorizeAdmin(key);return this.appService.reviewReservation(id,body);}
 @Patch('api/admin/reports/:id') resolve(@Param('id') id:string,@Body() body:unknown,@Headers('authorization') key?:string){this.appService.authorizeAdmin(key);return this.appService.resolveReport(id,body);}
 @Post('api/admin/manage/:kind') createAdmin(@Param('kind') kind:string,@Body() body:unknown,@Headers('authorization') key?:string){this.appService.authorizeAdmin(key);return kind==='facilities'?this.appService.createFacility(body):this.appService.adminCreate(kind,body);}
 @Patch('api/admin/manage/:kind/:id') editAdmin(@Param('kind') kind:string,@Param('id') id:string,@Body() body:unknown,@Headers('authorization') key?:string){this.appService.authorizeAdmin(key);return kind==='facilities'?this.appService.updateFacility(id,body):this.appService.adminUpdate(kind,id,body);}
 @Delete('api/admin/manage/:kind/:id') deleteAdmin(@Param('kind') kind:string,@Param('id') id:string,@Headers('authorization') key?:string){this.appService.authorizeAdmin(key);return kind==='facilities'?this.appService.deleteFacility(id):this.appService.adminDelete(kind,id);}
}
