-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "session_revoke_reason" AS ENUM ('LOGOUT', 'TOKEN_REUSE', 'PASSWORD_CHANGE');

-- CreateEnum
CREATE TYPE "social_type" AS ENUM ('TELEGRAM', 'VK', 'INSTAGRAM', 'WHATSAPP', 'YOUTUBE', 'TIKTOK', 'PINTEREST', 'WEBSITE', 'OTHER');

-- CreateEnum
CREATE TYPE "lead_type" AS ENUM ('TAILORING', 'PARTNERSHIP', 'CONTACT');

-- CreateEnum
CREATE TYPE "lead_status" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE', 'SPAM');

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL DEFAULT '{}',
    "cover_id" UUID,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_images" (
    "key" TEXT NOT NULL,
    "media_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_images_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "gallery_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "media_id" UUID NOT NULL,
    "caption" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gallery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "type" "lead_type" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "status" "lead_status" NOT NULL DEFAULT 'NEW',
    "telegram_sent" BOOLEAN NOT NULL DEFAULT false,
    "telegram_error" TEXT,
    "ip_hash" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_type" "user_role" NOT NULL,
    "owner_id" UUID NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuidv7(),
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "alt" JSONB NOT NULL DEFAULT '{}',
    "original_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "label" JSONB NOT NULL,
    "href" TEXT NOT NULL,
    "show_in_header" BOOLEAN NOT NULL DEFAULT true,
    "show_in_footer" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("key","locale")
);

-- CreateTable
CREATE TABLE "news_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "excerpt" JSONB NOT NULL DEFAULT '{}',
    "body" JSONB NOT NULL DEFAULT '{}',
    "date" TIMESTAMP(3) NOT NULL,
    "image_id" UUID,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "title" JSONB NOT NULL,
    "text" JSONB NOT NULL DEFAULT '{}',
    "badge" JSONB NOT NULL DEFAULT '{}',
    "cta_label" JSONB NOT NULL DEFAULT '{}',
    "cta_href" TEXT,
    "valid_until" TIMESTAMP(3),
    "image_id" UUID,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "url" TEXT,
    "logo_id" UUID,
    "description" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "collection_id" UUID NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL DEFAULT '{}',
    "details" JSONB NOT NULL DEFAULT '{}',
    "price" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "product_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "author" TEXT NOT NULL,
    "role" JSONB NOT NULL DEFAULT '{}',
    "text" JSONB NOT NULL,
    "avatar_id" UUID,
    "rating" INTEGER,
    "user_id" UUID,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "user_agent" TEXT,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoke_reason" "session_revoke_reason",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" JSONB NOT NULL DEFAULT '{}',
    "review_rating_max" INTEGER NOT NULL DEFAULT 5,
    "seo_title" JSONB NOT NULL DEFAULT '{}',
    "seo_description" JSONB NOT NULL DEFAULT '{}',
    "og_image_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_links" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "type" "social_type" NOT NULL,
    "label" JSONB NOT NULL DEFAULT '{}',
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "role" "user_role" NOT NULL,
    "login" TEXT,
    "password_hash" TEXT,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collections_slug_key" ON "collections"("slug");

-- CreateIndex
CREATE INDEX "collections_published_order_idx" ON "collections"("published", "order");

-- CreateIndex
CREATE INDEX "collections_cover_id_idx" ON "collections"("cover_id");

-- CreateIndex
CREATE INDEX "content_images_media_id_idx" ON "content_images"("media_id");

-- CreateIndex
CREATE INDEX "gallery_items_published_order_idx" ON "gallery_items"("published", "order");

-- CreateIndex
CREATE INDEX "gallery_items_media_id_idx" ON "gallery_items"("media_id");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at" DESC);

-- CreateIndex
CREATE INDEX "leads_status_created_at_idx" ON "leads"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "leads_type_created_at_idx" ON "leads"("type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "leads_ip_hash_created_at_idx" ON "leads"("ip_hash", "created_at");

-- CreateIndex
CREATE INDEX "leads_telegram_sent_idx" ON "leads"("telegram_sent");

-- CreateIndex
CREATE UNIQUE INDEX "media_uuid_key" ON "media"("uuid");

-- CreateIndex
CREATE INDEX "media_owner_id_created_at_idx" ON "media"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "media_created_at_idx" ON "media"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_bucket_key_key" ON "media"("bucket", "key");

-- CreateIndex
CREATE INDEX "menu_items_published_order_idx" ON "menu_items"("published", "order");

-- CreateIndex
CREATE INDEX "messages_locale_idx" ON "messages"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "news_items_slug_key" ON "news_items"("slug");

-- CreateIndex
CREATE INDEX "news_items_published_date_idx" ON "news_items"("published", "date" DESC);

-- CreateIndex
CREATE INDEX "news_items_image_id_idx" ON "news_items"("image_id");

-- CreateIndex
CREATE INDEX "offers_published_order_idx" ON "offers"("published", "order");

-- CreateIndex
CREATE INDEX "offers_image_id_idx" ON "offers"("image_id");

-- CreateIndex
CREATE INDEX "partners_published_order_idx" ON "partners"("published", "order");

-- CreateIndex
CREATE INDEX "partners_logo_id_idx" ON "partners"("logo_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_collection_id_published_order_idx" ON "products"("collection_id", "published", "order");

-- CreateIndex
CREATE INDEX "product_images_product_id_order_idx" ON "product_images"("product_id", "order");

-- CreateIndex
CREATE INDEX "product_images_media_id_idx" ON "product_images"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_media_id_key" ON "product_images"("product_id", "media_id");

-- CreateIndex
CREATE INDEX "reviews_published_order_idx" ON "reviews"("published", "order");

-- CreateIndex
CREATE INDEX "reviews_avatar_id_idx" ON "reviews"("avatar_id");

-- CreateIndex
CREATE INDEX "reviews_user_id_idx" ON "reviews"("user_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_id_key" ON "refresh_tokens"("replaced_by_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "social_links_published_order_idx" ON "social_links"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_cover_id_fkey" FOREIGN KEY ("cover_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_images" ADD CONSTRAINT "content_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_logo_id_fkey" FOREIGN KEY ("logo_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_og_image_id_fkey" FOREIGN KEY ("og_image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Invariants Prisma cannot express (kept in sync with the comments in prisma/models/*.prisma)
-- ---------------------------------------------------------------------------

-- site_settings is a singleton; the review star scale is 1..10
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_singleton_check" CHECK ("id" = 1);
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_review_rating_max_check" CHECK ("review_rating_max" BETWEEN 1 AND 10);

-- Rating upper bound = site_settings.review_rating_max (validated in the app); 10 is the hard cap
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 10);

ALTER TABLE "products" ADD CONSTRAINT "products_price_check" CHECK ("price" IS NULL OR "price" >= 0);

ALTER TABLE "media" ADD CONSTRAINT "media_dimensions_check" CHECK ("width" > 0 AND "height" > 0 AND "size" >= 0);
-- S3 layout: <admin|user>/<owner_id>/<uuid>/<file>
ALTER TABLE "media" ADD CONSTRAINT "media_key_layout_check"
  CHECK ("key" LIKE lower("owner_type"::text) || '/' || "owner_id"::text || '/' || "uuid"::text || '/%');

-- Locale codes: "ru", "en", "pt-br" …
ALTER TABLE "messages" ADD CONSTRAINT "messages_locale_check" CHECK ("locale" ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$');
ALTER TABLE "leads" ADD CONSTRAINT "leads_locale_check" CHECK ("locale" ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$');

-- URL slugs: lowercase latin letters and digits, single hyphens between them ("menya-zapomnyat")
ALTER TABLE "collections" ADD CONSTRAINT "collections_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "products" ADD CONSTRAINT "products_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Accounts: logins are stored normalized (lowercase); an ADMIN can always sign in
ALTER TABLE "users" ADD CONSTRAINT "users_login_check" CHECK ("login" IS NULL OR "login" ~ '^[a-z0-9._@-]{3,64}$');
ALTER TABLE "users" ADD CONSTRAINT "users_admin_credentials_check"
  CHECK ("role" <> 'ADMIN' OR ("login" IS NOT NULL AND "password_hash" IS NOT NULL));

-- Sessions: a revoked session says why; refresh tokens store a sha256 hex digest and expire after creation
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_revoke_reason_check"
  CHECK (("revoked_at" IS NULL) = ("revoke_reason" IS NULL));
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_token_hash_check" CHECK ("token_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_expiry_check" CHECK ("expires_at" > "created_at");
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_not_self_replaced_check"
  CHECK ("replaced_by_id" IS NULL OR "replaced_by_id" <> "id");
