CREATE TABLE `hm_records` (
  `id` VARCHAR(36) NOT NULL,
  `kind` VARCHAR(20) NOT NULL,
  `owner` VARCHAR(36) NULL,
  `facility` VARCHAR(100) NOT NULL,
  `date` VARCHAR(10) NOT NULL,
  `status` VARCHAR(40) NULL,
  `payload` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `hm_records_kind_owner_idx`(`kind`, `owner`),
  INDEX `hm_records_kind_facility_date_idx`(`kind`, `facility`, `date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hm_write_lock` (
  `id` VARCHAR(20) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
