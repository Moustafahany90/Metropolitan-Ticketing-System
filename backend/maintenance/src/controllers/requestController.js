const requestService = require('../services/requestService');
const path = require('path');
const fs = require('fs');

/**
 * Create a new maintenance request
 * @route POST /api/requests
 */
exports.create = async (req, res) => {
  try {
    const { categoryId, priority, description, location, departmentId } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Maintenance description is required',
          details: { field: 'description' }
        }
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Maintenance category is required',
          details: { field: 'categoryId' }
        }
      });
    }

    const files = req.files || [];

    const request = await requestService.createRequest({
      requesterId: req.user.id,
      departmentId: departmentId || req.user.departmentId,
      categoryId: Number(categoryId),
      priority: priority || 'Normal',
      description,
      location,
      files
    });

    res.status(201).json({
      success: true,
      message: `Maintenance request ${request.ticketNumber} created successfully`,
      data: request
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] Create error:', error);
    res.status(500).json({
      error: {
        code: 'CREATE_FAILED',
        message: error.message || 'Failed to submit maintenance request',
        details: {}
      }
    });
  }
};

/**
 * List maintenance requests (filtered by user role and query params)
 * @route GET /api/requests
 */
exports.list = async (req, res) => {
  try {
    const { status, categoryId, priority, search } = req.query;

    const requests = await requestService.getRequests(req.user, {
      status,
      categoryId,
      priority,
      search
    });

    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] List error:', error);
    res.status(500).json({
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to retrieve maintenance requests',
        details: {}
      }
    });
  }
};

/**
 * Get request by ID
 * @route GET /api/requests/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await requestService.getRequestById(id, req.user);

    if (!request) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Maintenance request not found',
          details: {}
        }
      });
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] GetById error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: {
        code: status === 403 ? 'FORBIDDEN' : 'FETCH_FAILED',
        message: error.message || 'Failed to retrieve request details',
        details: {}
      }
    });
  }
};

/**
 * Add a comment to a request
 * @route POST /api/requests/:id/comments
 */
exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Comment text is required',
          details: { field: 'comment' }
        }
      });
    }

    // Verify user has access to view this request before commenting
    await requestService.getRequestById(id, req.user);

    const newComment = await requestService.addComment(id, req.user.id, comment);

    res.status(201).json({
      success: true,
      data: newComment
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] AddComment error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: {
        code: status === 403 ? 'FORBIDDEN' : 'COMMENT_FAILED',
        message: error.message || 'Failed to post comment',
        details: {}
      }
    });
  }
};

/**
 * Get all categories
 * @route GET /api/requests/categories
 */
exports.getCategories = async (req, res) => {
  try {
    const categories = await requestService.getCategories();
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] Categories error:', error);
    res.status(500).json({
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to retrieve categories',
        details: {}
      }
    });
  }
};

/**
 * Get all departments
 * @route GET /api/requests/departments
 */
exports.getDepartments = async (req, res) => {
  try {
    const departments = await requestService.getDepartments();
    res.json({
      success: true,
      data: departments
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] Departments error:', error);
    res.status(500).json({
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to retrieve departments',
        details: {}
      }
    });
  }
};

/**
 * Download attachment file
 * @route GET /api/requests/attachments/:filename
 */
exports.downloadAttachment = (req, res) => {
  try {
    const { filename } = req.params;
    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(__dirname, '../../uploads', safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Requested attachment file does not exist',
          details: {}
        }
      });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('[REQUEST CONTROLLER] Download error:', error);
    res.status(500).json({
      error: {
        code: 'DOWNLOAD_FAILED',
        message: 'Failed to download file',
        details: {}
      }
    });
  }
};

/**
 * Get role-aware dashboard statistics
 * @route GET /api/requests/stats
 */
exports.getStats = async (req, res) => {
  try {
    const stats = await requestService.getStats(req.user);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] Stats error:', error);
    res.status(500).json({
      error: {
        code: 'STATS_FAILED',
        message: 'Failed to retrieve request statistics',
        details: {}
      }
    });
  }
};

/**
 * Get available maintenance workers for assignment
 * @route GET /api/requests/workers
 */
exports.getAssignableWorkers = async (req, res) => {
  try {
    const workers = await requestService.getAssignableWorkers();
    res.json({
      success: true,
      data: workers
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] Workers error:', error);
    res.status(500).json({
      error: {
        code: 'FETCH_WORKERS_FAILED',
        message: 'Failed to retrieve maintenance workers',
        details: {}
      }
    });
  }
};

/**
 * Assign worker to request
 * @route POST /api/requests/:id/assign
 */
exports.assignWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { workerId, expectedCurrentStatus } = req.body;

    if (!workerId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Worker selection is required for assignment',
          details: { field: 'workerId' }
        }
      });
    }

    const updated = await requestService.assignWorker(id, req.user, workerId, expectedCurrentStatus);

    res.json({
      success: true,
      message: `Request ${updated.ticketNumber} assigned successfully to ${updated.assignedTo?.displayName || 'worker'}`,
      data: updated
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] Assign error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: {
        code: status === 409 ? 'CONCURRENCY_CONFLICT' : (status === 400 ? 'VALIDATION_ERROR' : 'ASSIGNMENT_FAILED'),
        message: error.message || 'Failed to assign maintenance worker',
        details: {}
      }
    });
  }
};

/**
 * Reject a request with mandatory reason
 * @route POST /api/requests/:id/reject
 */
exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, expectedCurrentStatus } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Rejection reason is required',
          details: { field: 'reason' }
        }
      });
    }

    const updated = await requestService.rejectRequest(id, req.user, reason, expectedCurrentStatus);

    res.json({
      success: true,
      message: `Request ${updated.ticketNumber} has been rejected`,
      data: updated
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] Reject error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: {
        code: status === 409 ? 'CONCURRENCY_CONFLICT' : (status === 400 ? 'VALIDATION_ERROR' : 'REJECT_FAILED'),
        message: error.message || 'Failed to reject request',
        details: {}
      }
    });
  }
};

/**
 * Mark a request as received by supervisor
 * @route POST /api/requests/:id/receive
 */
exports.receiveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await requestService.receiveRequest(id, req.user);

    res.json({
      success: true,
      message: `Request ${updated.ticketNumber} marked as received`,
      data: updated
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] Receive error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: {
        code: 'RECEIVE_FAILED',
        message: error.message || 'Failed to receive request',
        details: {}
      }
    });
  }
};

/**
 * Start work on a maintenance request
 * @route POST /api/requests/:id/start-work
 */
exports.startWork = async (req, res) => {
  try {
    const { id } = req.params;
    const { expectedCurrentStatus } = req.body;

    const updated = await requestService.startWork(id, req.user, expectedCurrentStatus);

    res.json({
      success: true,
      message: `Work started on ${updated.ticketNumber}`,
      data: updated
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] StartWork error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: {
        code: status === 409 ? 'CONCURRENCY_CONFLICT' : (status === 403 ? 'FORBIDDEN' : (status === 400 ? 'VALIDATION_ERROR' : 'START_WORK_FAILED')),
        message: error.message || 'Failed to start work on request',
        details: {}
      }
    });
  }
};

/**
 * Complete work on a maintenance request
 * @route POST /api/requests/:id/complete
 */
exports.completeWork = async (req, res) => {
  try {
    const { id } = req.params;
    const { actionTaken, maintenanceTime, finalReport, expectedCurrentStatus } = req.body;

    if (!actionTaken || !actionTaken.trim()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Action taken is required to complete the request',
          details: { field: 'actionTaken' }
        }
      });
    }

    const updated = await requestService.completeWork(id, req.user, {
      actionTaken,
      maintenanceTime,
      finalReport,
      expectedCurrentStatus
    });

    res.json({
      success: true,
      message: `Request ${updated.ticketNumber} marked as completed`,
      data: updated
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] CompleteWork error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: {
        code: status === 409 ? 'CONCURRENCY_CONFLICT' : (status === 403 ? 'FORBIDDEN' : (status === 400 ? 'VALIDATION_ERROR' : 'COMPLETE_WORK_FAILED')),
        message: error.message || 'Failed to complete maintenance work',
        details: {}
      }
    });
  }
};

/**
 * Request spare parts for a maintenance request
 * @route POST /api/requests/:id/spare-parts
 */
exports.requestSparePart = async (req, res) => {
  try {
    const { id } = req.params;
    const { partName, quantity, notes } = req.body;

    if (!partName || !partName.trim()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Part name is required',
          details: { field: 'partName' }
        }
      });
    }

    if (!quantity || parseInt(quantity, 10) <= 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Quantity must be at least 1',
          details: { field: 'quantity' }
        }
      });
    }

    const sparePart = await requestService.requestSparePart(id, req.user, {
      partName,
      quantity,
      notes
    });

    res.status(201).json({
      success: true,
      message: `Spare part '${sparePart.partName}' requested successfully`,
      data: sparePart
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] RequestSparePart error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: {
        code: status === 403 ? 'FORBIDDEN' : (status === 400 ? 'VALIDATION_ERROR' : 'REQUEST_SPARE_PART_FAILED'),
        message: error.message || 'Failed to request spare parts',
        details: {}
      }
    });
  }
};

/**
 * List spare parts across requests (Storekeeper, Supervisor, Admin)
 * @route GET /api/requests/spare-parts
 */
exports.listSpareParts = async (req, res) => {
  try {
    const { requestId, status } = req.query;
    const spareParts = await requestService.getSpareParts({ requestId, status });

    res.json({
      success: true,
      data: spareParts
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] ListSpareParts error:', error);
    res.status(500).json({
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to retrieve spare parts',
        details: {}
      }
    });
  }
};

/**
 * Release spare parts (Storekeeper, Supervisor, Admin)
 * @route POST /api/requests/spare-parts/:partId/release
 */
exports.releaseSparePart = async (req, res) => {
  try {
    const { partId } = req.params;
    const { notes } = req.body;

    const updated = await requestService.releaseSparePart(partId, req.user, { notes });

    res.json({
      success: true,
      message: `Spare part '${updated.partName}' released successfully`,
      data: updated
    });
  } catch (error) {
    console.error('[REQUEST CONTROLLER] ReleaseSparePart error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: {
        code: status === 403 ? 'FORBIDDEN' : (status === 400 ? 'VALIDATION_ERROR' : 'RELEASE_FAILED'),
        message: error.message || 'Failed to release spare part',
        details: {}
      }
    });
  }
};

