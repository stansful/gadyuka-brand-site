import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';

import { FileInterceptor, UploadedMultipartFile } from '@nestjs/platform-fastify/multipart';

import { MEDIA_UPLOAD_FIELD } from '~core/media/media-library.constants';
import { UserRole } from '~core/users/user-role';
import { CurrentUser, Roles } from '~decorator';
import { AuthenticatedUser } from '~module/auth-token';
import { MediaItemResponse } from '~usecases/admin/media/common/media-item.response';

import { MediaUploadErrorInterceptor } from './media-upload-error.interceptor';
import { MediaUploadDto } from './media-upload.dto';
import { MediaUploadOptions } from './media-upload.options';
import { MEDIA_UPLOAD_ROUTE } from './media-upload.route';
import { MediaUploadUsecase } from './media-upload.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class MediaUploadController {
  constructor(private readonly usecase: MediaUploadUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Загрузить изображение в медиатеку',
    description: 'Одно изображение в поле file → WebP не больше 2400×2400, строка медиатеки.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: MediaUploadDto })
  @ApiCreatedResponse({ type: MediaItemResponse })
  @ApiBadRequestResponse({ description: 'admin.media.errors.noFile | unreadable | empty | processingFailed' })
  @ApiPayloadTooLargeResponse({ description: 'admin.media.errors.tooLarge { size }' })
  @ApiUnsupportedMediaTypeResponse({ description: 'admin.media.errors.unsupported { formats }' })
  @UseInterceptors(MediaUploadErrorInterceptor, FileInterceptor(MEDIA_UPLOAD_FIELD, MediaUploadOptions.MULTIPART))
  @Post(MEDIA_UPLOAD_ROUTE)
  async execute(
    @UploadedFile() file: UploadedMultipartFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MediaItemResponse> {
    return this.usecase.execute({
      data: file?.buffer,
      originalName: file?.originalname,
      owner: { ownerType: user.role, ownerId: user.id },
    });
  }
}
