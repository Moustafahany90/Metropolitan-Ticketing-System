const prisma = require('./src/db');

const ROLES = [
  { name: 'EMPLOYEE', description: 'Default role for authenticated users' },
  { name: 'SUPERVISOR', description: 'Can review and assign requests' },
  { name: 'MAINTENANCE_WORKER', description: 'Can execute maintenance work' },
  { name: 'STORE_KEEPER', description: 'Can manage spare parts' },
  { name: 'ADMIN', description: 'Full system access' }
];

const DEFAULT_CATEGORIES = [
  'Electrical',
  'Plumbing',
  'Air Conditioning & HVAC',
  'Carpentry & Furniture',
  'Civil & Painting',
  'Smart Boards & Classroom AV',
  'Locks & Security Doors',
  'General Maintenance'
];

const DEFAULT_DEPARTMENTS = [
  'Elementary Education',
  'Middle Education',
  'Secondary Education',
  'General Administration',
  'Facilities & Maintenance',
  'Store & Inventory',
  'Transportation',
  'Fine Arts & Activities',
  'Physical Education'
];

async function seedAll() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role
    });
  }
  console.log(`[SEED] Ensured ${ROLES.length} roles.`);

  for (const name of DEFAULT_CATEGORIES) {
    await prisma.maintenanceCategory.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
  console.log(`[SEED] Ensured ${DEFAULT_CATEGORIES.length} categories.`);

  for (const name of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
  console.log(`[SEED] Ensured ${DEFAULT_DEPARTMENTS.length} departments.`);
}

async function seedCategoriesAndDepartments() {
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.maintenanceCategory.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
  for (const name of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
}

if (require.main === module) {
  seedAll()
    .then(async () => {
      await prisma.$disconnect();
      console.log('[SEED] Completed successfully.');
    })
    .catch(async (e) => {
      console.error('[SEED] Error:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}

module.exports = { seedAll, seedCategoriesAndDepartments, ROLES, DEFAULT_CATEGORIES, DEFAULT_DEPARTMENTS };
