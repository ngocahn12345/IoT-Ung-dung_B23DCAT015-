-- Cơ sở dữ liệu MySQL cho hệ thống EcoLiving Smart Home IoT
-- Khớp thiết kế ERD 5 bảng: User, Devices, Sensors, DataSensor, Action_history

CREATE DATABASE IF NOT EXISTS `ecoliving_iot`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `ecoliving_iot`;

CREATE TABLE IF NOT EXISTS `User` (
  `user_id` INT(10) NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `fullname` VARCHAR(150) NOT NULL,
  `created_at` DATE NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `student_id` VARCHAR(50) NOT NULL,
  `dob` DATE NOT NULL,
  `gender` VARCHAR(10) NOT NULL,
  `phone` VARCHAR(15) NOT NULL,
  `address` VARCHAR(255) NOT NULL,
  `school` VARCHAR(150) NOT NULL,
  `major` VARCHAR(100) NOT NULL,
  `cohort` VARCHAR(50) NOT NULL,
  `github_link` VARCHAR(255) NULL DEFAULT NULL,
  `figma_link` VARCHAR(255) NULL DEFAULT NULL,
  `avatar` VARCHAR(255) NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  `postman_url` VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_user_username` (`username`),
  UNIQUE KEY `uq_user_email` (`email`),
  UNIQUE KEY `uq_user_student_id` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Devices` (
  `device_id` INT(10) NOT NULL AUTO_INCREMENT,
  `device_name` VARCHAR(100) NOT NULL,
  `status` VARCHAR(10) NOT NULL DEFAULT 'OFF',
  `mode` VARCHAR(10) NOT NULL DEFAULT 'Auto',
  `device_type` VARCHAR(50) NOT NULL,
  `description` VARCHAR(255) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`device_id`),
  UNIQUE KEY `uq_devices_name` (`device_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Sensors` (
  `sensor_id` INT(10) NOT NULL AUTO_INCREMENT,
  `sensor_name` VARCHAR(50) NOT NULL,
  `location` VARCHAR(100) NOT NULL,
  `type` VARCHAR(255) NOT NULL,
  `status` VARCHAR(100) NOT NULL DEFAULT 'NORMAL',
  `unit` VARCHAR(20) NOT NULL,
  `description` VARCHAR(255) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sensor_id`),
  UNIQUE KEY `uq_sensors_name` (`sensor_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `DataSensor` (
  `data_id` BIGINT(20) NOT NULL AUTO_INCREMENT,
  `value` DOUBLE NOT NULL,
  `timestamp` DATETIME NOT NULL,
  `sensor_id` INT(10) NOT NULL,
  `alert_status` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`data_id`),
  KEY `idx_datasensor_sensor_ts` (`sensor_id`, `timestamp`),
  KEY `idx_datasensor_ts` (`timestamp`),
  CONSTRAINT `fk_datasensor_sensor`
    FOREIGN KEY (`sensor_id`) REFERENCES `Sensors` (`sensor_id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Action_history` (
  `action_id` BIGINT(20) NOT NULL AUTO_INCREMENT,
  `action_type` VARCHAR(10) NOT NULL,
  `status` VARCHAR(255) NOT NULL,
  `user_id` INT(10) NULL DEFAULT NULL,
  `device_id` INT(10) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `activation_time` DATETIME(3) NOT NULL,
  `response_time` DATETIME(3) NULL DEFAULT NULL,
  PRIMARY KEY (`action_id`),
  KEY `idx_action_device` (`device_id`),
  KEY `idx_action_user` (`user_id`),
  CONSTRAINT `fk_action_user`
    FOREIGN KEY (`user_id`) REFERENCES `User` (`user_id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_action_device`
    FOREIGN KEY (`device_id`) REFERENCES `Devices` (`device_id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

