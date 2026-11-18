const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// All request endpoints require an authenticated user
router.use(requireAuth);

// Categories & Departments lookup
router.get('/categories', requestController.getCategories);
router.get('/departments', requestController.getDepartments);

// Role-aware stats endpoint
router.get('/stats', requestController.getStats);

// List assignable maintenance workers (Supervisor/Admin only)
router.get('/workers', requireRole('SUPERVISOR', 'ADMIN'), requestController.getAssignableWorkers);

// Attachment downloading
router.get('/attachments/:filename', requestController.downloadAttachment);

// List & Create maintenance requests
router.get('/', requestController.list);
router.post('/', upload.array('attachments', 5), requestController.create);

// Phase 4 Spare Parts Global Management
router.get('/spare-parts', requestController.listSpareParts);
router.post('/spare-parts/:partId/release', requireRole('STORE_KEEPER', 'SUPERVISOR', 'ADMIN'), requestController.releaseSparePart);

// Phase 3 Management Actions (Supervisor/Admin only)
router.post('/:id/assign', requireRole('SUPERVISOR', 'ADMIN'), requestController.assignWorker);
router.post('/:id/reject', requireRole('SUPERVISOR', 'ADMIN'), requestController.rejectRequest);
router.post('/:id/receive', requireRole('SUPERVISOR', 'ADMIN'), requestController.receiveRequest);

// Phase 4 Work Execution & Request-level Spare Parts
router.post('/:id/start-work', requireRole('MAINTENANCE_WORKER', 'SUPERVISOR', 'ADMIN'), requestController.startWork);
router.post('/:id/complete', requireRole('MAINTENANCE_WORKER', 'SUPERVISOR', 'ADMIN'), requestController.completeWork);
router.post('/:id/spare-parts', requireRole('MAINTENANCE_WORKER', 'SUPERVISOR', 'ADMIN'), requestController.requestSparePart);

// Single request detail & comments
router.get('/:id', requestController.getById);
router.post('/:id/comments', requestController.addComment);

module.exports = router;

