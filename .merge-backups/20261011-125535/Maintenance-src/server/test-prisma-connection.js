const { PrismaClient } = require('./node_modules/@prisma/client/index');
const prisma = new PrismaClient();
console.log('Prisma client instantiated successfully');
prisma.$disconnect();