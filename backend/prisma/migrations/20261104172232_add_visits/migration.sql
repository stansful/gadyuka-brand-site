-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "hour_bucket" TIMESTAMP(3) NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "first_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" VARCHAR(512),
    "path" VARCHAR(2048),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visits_hour_bucket_idx" ON "visits"("hour_bucket" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "visits_hour_bucket_ip_hash_key" ON "visits"("hour_bucket", "ip_hash");
