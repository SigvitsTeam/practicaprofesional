import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const buildOnlyUrl = 'postgresql://unconfigured:unconfigured@127.0.0.1:5432/unconfigured';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? buildOnlyUrl },
});
