import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { OperationalDemoSeeder } from './operational-demo.seeder';

async function run(): Promise<void> {
  const logger = new Logger('ShowcaseSeed');
  // The command explicitly invokes the operational seeder below; prevent the
  // application bootstrap hook from running the complete seed suite first.
  process.env.SKIP_SEED = 'true';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    await app.get(OperationalDemoSeeder).seed();
    logger.log('Showcase data seeded successfully for the rolling three-day horizon.');
  } finally {
    await app.close();
  }
}

run().catch(() => {
  process.exitCode = 1;
});
