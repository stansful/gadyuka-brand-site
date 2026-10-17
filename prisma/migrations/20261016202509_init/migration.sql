-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('TEXT', 'RICHTEXT', 'IMAGE', 'LINK');

-- CreateEnum
CREATE TYPE "LeadType" AS ENUM ('TAILORING', 'PARTNERSHIP', 'CONTACT');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE', 'SPAM');

-- CreateTable
CREATE TABLE "ContentBlock" (
    "key" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "kind" "ContentKind" NOT NULL DEFAULT 'TEXT',
    "value" JSONB,
    "mediaId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBlock_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "alt" JSONB NOT NULL DEFAULT '{}',
    "originalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL DEFAULT '{}',
    "coverId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL DEFAULT '{}',
    "details" JSONB NOT NULL DEFAULT '{}',
    "price" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "role" JSONB NOT NULL DEFAULT '{}',
    "text" JSONB NOT NULL,
    "avatarId" TEXT,
    "rating" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "excerpt" JSONB NOT NULL DEFAULT '{}',
    "body" JSONB NOT NULL DEFAULT '{}',
    "date" TIMESTAMP(3) NOT NULL,
    "imageId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryItem" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "caption" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "text" JSONB NOT NULL DEFAULT '{}',
    "badge" JSONB NOT NULL DEFAULT '{}',
    "ctaLabel" JSONB NOT NULL DEFAULT '{}',
    "ctaHref" TEXT,
    "validUntil" TIMESTAMP(3),
    "imageId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "logoId" TEXT,
    "description" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "type" "LeadType" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "telegramSent" BOOLEAN NOT NULL DEFAULT false,
    "telegramError" TEXT,
    "ipHash" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" JSONB NOT NULL DEFAULT '{}',
    "socials" JSONB NOT NULL DEFAULT '[]',
    "seoTitle" JSONB NOT NULL DEFAULT '{}',
    "seoDescription" JSONB NOT NULL DEFAULT '{}',
    "ogImageId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentBlock_section_order_idx" ON "ContentBlock"("section", "order");

-- CreateIndex
CREATE INDEX "ContentBlock_mediaId_idx" ON "ContentBlock"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "Media_path_key" ON "Media"("path");

-- CreateIndex
CREATE INDEX "Media_createdAt_idx" ON "Media"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");

-- CreateIndex
CREATE INDEX "Collection_published_order_idx" ON "Collection"("published", "order");

-- CreateIndex
CREATE INDEX "Collection_coverId_idx" ON "Collection"("coverId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_collectionId_published_order_idx" ON "Product"("collectionId", "published", "order");

-- CreateIndex
CREATE INDEX "ProductImage_productId_order_idx" ON "ProductImage"("productId", "order");

-- CreateIndex
CREATE INDEX "ProductImage_mediaId_idx" ON "ProductImage"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_productId_mediaId_key" ON "ProductImage"("productId", "mediaId");

-- CreateIndex
CREATE INDEX "Review_published_order_idx" ON "Review"("published", "order");

-- CreateIndex
CREATE INDEX "Review_avatarId_idx" ON "Review"("avatarId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_slug_key" ON "NewsItem"("slug");

-- CreateIndex
CREATE INDEX "NewsItem_published_date_idx" ON "NewsItem"("published", "date" DESC);

-- CreateIndex
CREATE INDEX "NewsItem_imageId_idx" ON "NewsItem"("imageId");

-- CreateIndex
CREATE INDEX "GalleryItem_published_order_idx" ON "GalleryItem"("published", "order");

-- CreateIndex
CREATE INDEX "GalleryItem_mediaId_idx" ON "GalleryItem"("mediaId");

-- CreateIndex
CREATE INDEX "Offer_published_order_idx" ON "Offer"("published", "order");

-- CreateIndex
CREATE INDEX "Offer_imageId_idx" ON "Offer"("imageId");

-- CreateIndex
CREATE INDEX "Partner_published_order_idx" ON "Partner"("published", "order");

-- CreateIndex
CREATE INDEX "Partner_logoId_idx" ON "Partner"("logoId");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Lead_type_createdAt_idx" ON "Lead"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Lead_ipHash_createdAt_idx" ON "Lead"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_telegramSent_idx" ON "Lead"("telegramSent");

-- AddForeignKey
ALTER TABLE "ContentBlock" ADD CONSTRAINT "ContentBlock_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_ogImageId_fkey" FOREIGN KEY ("ogImageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invariants Prisma cannot express in schema.prisma (Prisma ignores CHECK constraints when diffing).
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_singleton_check" CHECK ("id" = 1);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_check" CHECK ("rating" IS NULL OR ("rating" BETWEEN 1 AND 5));
ALTER TABLE "Product" ADD CONSTRAINT "Product_price_check" CHECK ("price" IS NULL OR "price" >= 0);
ALTER TABLE "Media" ADD CONSTRAINT "Media_dimensions_check" CHECK ("width" > 0 AND "height" > 0 AND "size" >= 0);
