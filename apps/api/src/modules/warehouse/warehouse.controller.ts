import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { DbUser } from '../../auth/auth.types';
import { CurrentUser, RequirePage } from '../../auth/decorators';
import { WarehouseService } from './warehouse.service';

/** Mọi route Kho cần quyền trang `kho`; thao tác ghi cần thêm `kho_edit` (kiểm tra trong service). */
@Controller('api/warehouse')
@RequirePage('kho')
export class WarehouseController {
  constructor(private readonly warehouse: WarehouseService) {}

  @Get()
  overview(@CurrentUser() user: DbUser) {
    return this.warehouse.overview(user);
  }

  @Get('snapshots')
  snapshots() {
    return this.warehouse.snapshots();
  }

  @Get('daily')
  daily(@Query('date') date: unknown) {
    return this.warehouse.daily(date);
  }

  @Put('order-production/:key')
  adjust(@CurrentUser() user: DbUser, @Param('key') key: string, @Body() body: any) {
    return this.warehouse.adjustOrderProduction(user, key, body);
  }

  @Post('daily-entry')
  @HttpCode(201)
  createEntry(@CurrentUser() user: DbUser, @Body() body: any) {
    return this.warehouse.createDailyEntry(user, body);
  }

  @Put('daily-entry/:id')
  updateEntry(@CurrentUser() user: DbUser, @Param('id') id: string, @Body() body: any) {
    return this.warehouse.updateDailyEntry(user, id, body);
  }

  @Delete('daily-entry/:id')
  deleteEntry(@CurrentUser() user: DbUser, @Param('id') id: string) {
    return this.warehouse.deleteDailyEntry(user, id);
  }

  @Post('daily-close')
  @HttpCode(200)
  close(@CurrentUser() user: DbUser, @Body() body: any) {
    return this.warehouse.closeDay(user, body);
  }

  @Post('items')
  @HttpCode(201)
  createItem(@CurrentUser() user: DbUser, @Body() body: any) {
    return this.warehouse.createItem(user, body);
  }

  @Patch('items/:category/:id')
  updateItem(@CurrentUser() user: DbUser, @Param('category') category: string, @Param('id') id: string, @Body() body: any) {
    return this.warehouse.updateItem(user, category, id, body);
  }

  @Delete('items/:category/:id')
  deleteItem(@CurrentUser() user: DbUser, @Param('category') category: string, @Param('id') id: string) {
    return this.warehouse.deleteItem(user, category, id);
  }

  @Post('transactions')
  @HttpCode(200)
  createTransaction(@CurrentUser() user: DbUser, @Body() body: any) {
    return this.warehouse.createTransaction(user, body);
  }
}
