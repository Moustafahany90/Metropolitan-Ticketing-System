const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
  try {
    // Test connection by querying users
    const users = await prisma.user.findMany();
    console.log('Connected to database successfully');
    console.log(`Found ${users.length} users`);

    // Test creating a role if none exist
    if (users.length === 0) {
      console.log('No users found, creating test data...');

      // Create roles
      const employeeRole = await prisma.role.create({
        data: {
          name: 'EMPLOYEE',
          description: 'Default role for authenticated users'
        }
      });

      const adminRole = await prisma.role.create({
        data: {
          name: 'ADMIN',
          description: 'System administrator'
        }
      });

      console.log('Created roles:', employeeRole.name, adminRole.name);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Database connection error:', error);
    await prisma.$disconnect();
  }
}

testConnection();