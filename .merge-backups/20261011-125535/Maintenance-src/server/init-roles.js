const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function initRoles() {
  try {
    const roles = [
      { name: 'EMPLOYEE', description: 'Default role for authenticated users' },
      { name: 'SUPERVISOR', description: 'Can review and assign requests' },
      { name: 'MAINTENANCE_WORKER', description: 'Can execute maintenance work' },
      { name: 'STORE_KEEPER', description: 'Can manage spare parts' },
      { name: 'ADMIN', description: 'Full system access' }
    ];

    for (const roleData of roles) {
      const existingRole = await prisma.role.findFirst({
        where: { name: roleData.name }
      });

      if (!existingRole) {
        const role = await prisma.role.create({ data: roleData });
        console.log(`Created role: ${role.name}`);
      } else {
        console.log(`Role already exists: ${existingRole.name}`);
      }
    }

    console.log('Role initialization complete');
  } catch (error) {
    console.error('Error initializing roles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initRoles();