const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  'Middle School',
  'High School',
  'Early Childhood (KG)',
  'Facilities & Maintenance',
  'IT & Technology',
  'Administration & Finance',
  'Physical Education & Athletics',
  'Science Laboratories'
];

async function seedCategoriesAndDepartments() {
  console.log('[SEED] Seeding categories and departments...');
  
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.maintenanceCategory.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
  console.log(`[SEED] Ensured ${DEFAULT_CATEGORIES.length} maintenance categories.`);

  for (const name of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
  console.log(`[SEED] Ensured ${DEFAULT_DEPARTMENTS.length} departments.`);
}

if (require.main === module) {
  seedCategoriesAndDepartments()
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

module.exports = { seedCategoriesAndDepartments };
