/**
 * File này: các đường dẫn API của trang Kho (/api/warehouse/...).
 * Dùng ở: trang /kho (tổng quan, nhập sản lượng ngày, chốt kho, danh mục, nhập/xuất).
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import type { DbUser } from '../../auth/auth.types';
import { CurrentUser, RequirePage } from '../../auth/decorators';
import { WarehouseService } from './warehouse.service';

/** Mọi route Kho cần quyền trang `kho`; thao tác ghi cần thêm `kho_edit` (kiểm tra trong service). */
@Controller('api/warehouse')
@RequirePage('kho')
export class WarehouseController {
  constructor(private readonly warehouse: WarehouseService) {}

  /** Tổng quan kho: hàng hóa, bao bì, vật tư, giao dịch gần đây, ngày đã chốt. */
  @Get()
  overview(@CurrentUser() user: DbUser) {
    return this.warehouse.overview(user);
  }

  /** Danh sách các ngày đã chốt (bản chụp mới nhất mỗi ngày). */
  @Get('snapshots')
  snapshots() {
    return this.warehouse.snapshots();
  }

  /** Bảng sản lượng Kho của 1 ngày (?date=YYYY-MM-DD). */
  @Get('daily')
  daily(@Query('date') date: unknown) {
    return this.warehouse.daily(date);
  }

  /** Sửa sản lượng cộng dồn + ghi chú của 1 đơn (cần kho_edit). */
  @Put('order-production/:key')
  adjust(@CurrentUser() user: DbUser, @Param('key') key: string, @Body() body: any) {
    return this.warehouse.adjustOrderProduction(user, key, body);
  }

  /** Thêm 1 lần nhập sản lượng trong ngày (cần kho_edit). */
  @Post('daily-entry')
  @HttpCode(201)
  createEntry(@CurrentUser() user: DbUser, @Body() body: any) {
    return this.warehouse.createDailyEntry(user, body);
  }

  /** Sửa 1 lần nhập sản lượng (cần kho_edit). */
  @Put('daily-entry/:id')
  updateEntry(@CurrentUser() user: DbUser, @Param('id') id: string, @Body() body: any) {
    return this.warehouse.updateDailyEntry(user, id, body);
  }

  /** Xóa 1 lần nhập sản lượng (cần kho_edit). */
  @Delete('daily-entry/:id')
  deleteEntry(@CurrentUser() user: DbUser, @Param('id') id: string) {
    return this.warehouse.deleteDailyEntry(user, id);
  }

  /** Chốt kho cuối ngày: lưu ảnh chụp bảng Kho (cần kho_edit). */
  @Post('daily-close')
  @HttpCode(200)
  close(@CurrentUser() user: DbUser, @Body() body: any) {
    return this.warehouse.closeDay(user, body);
  }

  /** Thêm mặt hàng vào danh mục (cần kho_edit). */
  @Post('items')
  @HttpCode(201)
  createItem(@CurrentUser() user: DbUser, @Body() body: any) {
    return this.warehouse.createItem(user, body);
  }

  /** Sửa mặt hàng trong danh mục (cần kho_edit). */
  @Patch('items/:category/:id')
  updateItem(@CurrentUser() user: DbUser, @Param('category') category: string, @Param('id') id: string, @Body() body: any) {
    return this.warehouse.updateItem(user, category, id, body);
  }

  /** Xóa mặt hàng khỏi danh mục (cần kho_edit). */
  @Delete('items/:category/:id')
  deleteItem(@CurrentUser() user: DbUser, @Param('category') category: string, @Param('id') id: string) {
    return this.warehouse.deleteItem(user, category, id);
  }

  /** Nhập/xuất kho 1 mặt hàng (cần kho_edit). */
  @Post('transactions')
  @HttpCode(200)
  createTransaction(@CurrentUser() user: DbUser, @Body() body: any) {
    return this.warehouse.createTransaction(user, body);
  }
}
