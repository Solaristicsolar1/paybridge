import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async checkHealth() {
    try {
      // Execute a real query against PostgreSQL
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        application: 'PayBridge API',
        database: 'connected',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        application: 'PayBridge API',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
