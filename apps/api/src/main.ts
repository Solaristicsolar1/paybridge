import "reflect-metadata";

import { resolve } from "node:path";
import { config } from "dotenv";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import cookieParser from "cookie-parser";
import helmet from "helmet";

import { AppModule } from "./app.module";

// Load environment variables from the PayBridge root directory
config({
  path: resolve(process.cwd(), "../../.env"),
});

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Parse incoming cookies
  app.use(cookieParser());

  // Apply HTTP security headers
  app.use(helmet());

  // Restrict browser access to our frontend
  const allowedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  });

  // Validate all incoming request bodies
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API version prefix
  app.setGlobalPrefix("v1");

  const port = Number(process.env.PORT ?? 4000);

  await app.listen(port, "0.0.0.0");

  console.log(`PayBridge API running on port ${port}`);
}

void bootstrap();
