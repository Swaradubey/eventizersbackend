-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "main_text" TEXT,
    "message" TEXT,
    "accent_color" TEXT NOT NULL DEFAULT '#5B5FEF',
    "background_color" TEXT NOT NULL DEFAULT '#F6F9FC',
    "text_color" TEXT NOT NULL DEFAULT '#1A1118',
    "title_size" INTEGER NOT NULL DEFAULT 48,
    "font_weight" TEXT NOT NULL DEFAULT 'normal',
    "font_family" TEXT NOT NULL DEFAULT 'sans-serif',
    "text_alignment" TEXT NOT NULL DEFAULT 'center',
    "image_url" TEXT,
    "button_text" TEXT NOT NULL DEFAULT 'RSVP Now',
    "button_color" TEXT NOT NULL DEFAULT '#5B5FEF',
    "button_radius" INTEGER NOT NULL DEFAULT 8,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_event_id_key" ON "invitations"("event_id");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
