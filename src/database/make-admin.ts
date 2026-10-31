import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { ADMIN_ROLE } from '../roles/permission-names';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';

// Gives a registered user the admin role, as the API cannot grant the first one.
async function makeAdmin(email: string | undefined) {
  if (!email) {
    throw new Error('Usage: npm run make-admin -- <email>');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const manager = app.get(DataSource).manager;
    const user = await manager.findOneBy(User, {
      email: email.trim().toLowerCase(),
    });
    if (!user) {
      throw new Error(`No user with email ${email}`);
    }

    const role = await manager.findOneByOrFail(Role, { name: ADMIN_ROLE });
    await manager
      .createQueryBuilder()
      .insert()
      .into('user_roles')
      .values({ userId: user.id, roleId: role.id })
      .orIgnore()
      .execute();

    console.log(`${user.email} is now an admin`);
  } finally {
    await app.close();
  }
}

makeAdmin(process.argv[2]).catch((error) => {
  console.error(error);
  process.exit(1);
});
