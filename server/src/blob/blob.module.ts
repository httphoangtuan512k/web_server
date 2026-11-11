import { Global, Module } from '@nestjs/common';
import { BlobService } from './blob.service';
import { FilesController } from './files.controller';
import { UploadsController } from './uploads.controller';

@Global()
@Module({ providers: [BlobService], controllers: [FilesController, UploadsController], exports: [BlobService] })
export class BlobModule {}
