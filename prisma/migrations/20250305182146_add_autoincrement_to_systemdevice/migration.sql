-- AlterTable
CREATE SEQUENCE systemdevice_id_seq;
ALTER TABLE "systemDevice" ALTER COLUMN "id" SET DEFAULT nextval('systemdevice_id_seq');
ALTER SEQUENCE systemdevice_id_seq OWNED BY "systemDevice"."id";
