import { Module } from '@nestjs/common';
import { LoginSessionsController, UsersController } from './users.controller';

@Module({ controllers: [UsersController, LoginSessionsController], providers: [], exports: [] })
export class UsersModule {}
