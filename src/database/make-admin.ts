import { EntityManager } from '@mikro-orm/postgresql';
import { NestFactory } from '@nestjs/core';
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
    const em = app.get(EntityManager).fork();
    const user = await em.findOne(
      User,
      { email: email.trim().toLowerCase() },
      { populate: ['roles'] },
    );
    if (!user) {
      throw new Error(`No user with email ${email}`);
    }

    user.roles.add(await em.findOneOrFail(Role, { name: ADMIN_ROLE }));
    await em.flush();

    console.log(`${user.email} is now an admin`);
  } finally {
    await app.close();
  }
}

makeAdmin(process.argv[2]).catch((error) => {
  console.error(error);
  process.exit(1);
});
