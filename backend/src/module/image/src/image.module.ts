import { Module } from '@nestjs/common';

import { ImageJobQueue } from './image-job.queue';
import { ImageTypeDetector } from './image-type.detector';
import { ImageProcessor } from './image.processor';

@Module({
  providers: [ImageJobQueue, ImageTypeDetector, ImageProcessor],
  exports: [ImageProcessor, ImageTypeDetector],
})
export class ImageModule {}
