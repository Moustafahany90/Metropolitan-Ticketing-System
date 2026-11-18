const prisma = require('../db');

class RequestService {
  /**
   * Generates a globally sequential ticket number formatted as MNT-XXXXXX
   * Example: MNT-000001, MNT-000002
   */
  async generateTicketNumber() {
    const latest = await prisma.maintenanceRequest.findFirst({
      orderBy: { id: 'desc' },
      select: { ticketNumber: true, id: true }
    });

    let nextNumber = 1;
    if (latest && latest.ticketNumber) {
      const match = latest.ticketNumber.match(/MNT-(\d+)/i);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      } else {
        nextNumber = latest.id + 1;
      }
    }

    return `MNT-${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Create a new maintenance request
   */
  async createRequest({
    requesterId,
    departmentId,
    categoryId,
    priority = 'Normal',
    description,
    location = null,
    files = []
  }) {
    if (!description || !description.trim()) {
      throw new Error('Description is required');
    }
    if (!categoryId) {
      throw new Error('Maintenance category is required');
    }

    const validPriorities = ['Normal', 'High', 'Urgent'];
    const chosenPriority = validPriorities.includes(priority) ? priority : 'Normal';

    // Verify category exists
    const category = await prisma.maintenanceCategory.findUnique({
      where: { id: Number(categoryId) }
    });
    if (!category) {
      throw new Error(`Invalid category ID: ${categoryId}`);
    }

    // Verify requester
    const requester = await prisma.user.findUnique({
      where: { id: Number(requesterId) },
      include: { department: true, role: true }
    });
    if (!requester) {
      throw new Error(`Requester not found`);
    }

    const resolvedDepartmentId = departmentId ? Number(departmentId) : requester.departmentId;

    // Retry loop for unique ticket number generation in case of race condition
    let createdRequest = null;
    let attempts = 0;
    while (!createdRequest && attempts < 5) {
      attempts++;
      const ticketNumber = await this.generateTicketNumber();
      try {
        createdRequest = await prisma.maintenanceRequest.create({
          data: {
            ticketNumber,
            requesterId: requester.id,
            departmentId: resolvedDepartmentId,
            categoryId: category.id,
            priority: chosenPriority,
            description: description.trim(),
            location: location ? location.trim() : null,
            status: 'SUBMITTED'
          },
          include: {
            requester: {
              select: { id: true, username: true, displayName: true, email: true }
            },
            department: true,
            category: true
          }
        });
      } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('ticketNumber')) {
          // Unique constraint collided, retry with next increment
          continue;
        }
        throw err;
      }
    }

    if (!createdRequest) {
      throw new Error('Failed to generate unique ticket number after multiple attempts');
    }

    // Handle attachments if any
    if (files && files.length > 0) {
      for (const file of files) {
        await prisma.requestAttachment.create({
          data: {
            requestId: createdRequest.id,
            fileName: file.originalname,
            filePath: file.filename, // Stored in uploads/
            mimeType: file.mimetype,
            size: file.size
          }
        });
      }
    }

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        requestId: createdRequest.id,
        userId: requester.id,
        action: 'REQUEST_SUBMITTED',
        details: JSON.stringify({
          ticketNumber: createdRequest.ticketNumber,
          category: category.name,
          priority: chosenPriority,
          attachmentsCount: files.length
        })
      }
    });

    // Fetch full request record with attachments
    return await this.getRequestById(createdRequest.id, requester);
  }

  /**
   * Get requests filtered by role and criteria
   */
  async getRequests(user, filters = {}) {
    const where = {};

    // RBAC access limits
    const userRole = user?.role?.name || (typeof user?.role === 'string' ? user.role : null);
    if (userRole === 'EMPLOYEE') {
      where.requesterId = user.id;
    } else if (userRole === 'MAINTENANCE_WORKER') {
      where.OR = [
        { assignedToId: user.id },
        { assignments: { some: { userId: user.id } } }
      ];
    }
    // SUPERVISOR, ADMIN, and STORE_KEEPER can view all

    // Status filter
    if (filters.status) {
      where.status = filters.status;
    }

    // Category filter
    if (filters.categoryId) {
      where.categoryId = Number(filters.categoryId);
    }

    // Priority filter
    if (filters.priority) {
      where.priority = filters.priority;
    }

    // Search query (ticket number, description, or location)
    if (filters.search && filters.search.trim()) {
      const search = filters.search.trim();
      const searchCondition = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } }
      ];

      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchCondition }];
        delete where.OR;
      } else {
        where.OR = searchCondition;
      }
    }

    return await prisma.maintenanceRequest.findMany({
      where,
      include: {
        requester: {
          select: { id: true, username: true, displayName: true, email: true }
        },
        department: true,
        category: true,
        assignedTo: {
          select: { id: true, username: true, displayName: true }
        },
        _count: {
          select: {
            attachments: true,
            comments: true,
            spareParts: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get a single request by ID with RBAC check
   */
  async getRequestById(id, user) {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: Number(id) },
      include: {
        requester: {
          select: { id: true, username: true, displayName: true, email: true }
        },
        department: true,
        category: true,
        assignedTo: {
          select: { id: true, username: true, displayName: true, email: true }
        },
        assignedBy: {
          select: { id: true, username: true, displayName: true }
        },
        startedBy: {
          select: { id: true, username: true, displayName: true }
        },
        completedBy: {
          select: { id: true, username: true, displayName: true }
        },
        rejectedBy: {
          select: { id: true, username: true, displayName: true }
        },
        assignments: {
          include: {
            user: { select: { id: true, username: true, displayName: true } },
            assignedBy: { select: { id: true, username: true, displayName: true } }
          }
        },
        comments: {
          include: {
            user: { select: { id: true, username: true, displayName: true, role: true } }
          },
          orderBy: { createdAt: 'asc' }
        },
        spareParts: {
          include: {
            requestedBy: { select: { id: true, username: true, displayName: true } },
            releasedBy: { select: { id: true, username: true, displayName: true } }
          }
        },
        attachments: true,
        auditLogs: {
          include: {
            user: { select: { id: true, username: true, displayName: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!request) {
      return null;
    }

    // Role-based visibility check
    const userRole = user?.role?.name || (typeof user?.role === 'string' ? user.role : null);
    if (user && userRole === 'EMPLOYEE' && request.requesterId !== user.id) {
      const err = new Error('You do not have permission to view this request');
      err.status = 403;
      throw err;
    }

    return request;
  }

  /**
   * Add comment to a maintenance request
   */
  async addComment(requestId, userId, commentText) {
    if (!commentText || !commentText.trim()) {
      throw new Error('Comment cannot be empty');
    }

    const comment = await prisma.requestComment.create({
      data: {
        requestId: Number(requestId),
        userId: Number(userId),
        comment: commentText.trim()
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, role: true } }
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        requestId: Number(requestId),
        userId: Number(userId),
        action: 'COMMENT_ADDED',
        details: JSON.stringify({ commentId: comment.id })
      }
    });

    return comment;
  }

  /**
   * Get all categories
   */
  async getCategories() {
    return await prisma.maintenanceCategory.findMany({
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Get all departments
   */
  async getDepartments() {
    return await prisma.department.findMany({
      orderBy: { name: 'asc' }
    });
  }
  /**
   * Get role-aware statistics
   */
  async getStats(user) {
    const userRole = user?.role?.name || (typeof user?.role === 'string' ? user.role : 'EMPLOYEE');
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (userRole === 'EMPLOYEE') {
      const [total, submitted, inProgress, completed, rejected] = await Promise.all([
        prisma.maintenanceRequest.count({ where: { requesterId: user.id } }),
        prisma.maintenanceRequest.count({ where: { requesterId: user.id, status: 'SUBMITTED' } }),
        prisma.maintenanceRequest.count({ where: { requesterId: user.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } } }),
        prisma.maintenanceRequest.count({ where: { requesterId: user.id, status: 'COMPLETED' } }),
        prisma.maintenanceRequest.count({ where: { requesterId: user.id, status: 'REJECTED' } })
      ]);

      return {
        role: 'EMPLOYEE',
        total,
        submitted,
        inProgress,
        completed,
        rejected
      };
    }

    if (userRole === 'MAINTENANCE_WORKER') {
      const [assigned, inProgress, completed, total] = await Promise.all([
        prisma.maintenanceRequest.count({ where: { assignedToId: user.id, status: 'ASSIGNED' } }),
        prisma.maintenanceRequest.count({ where: { assignedToId: user.id, status: 'IN_PROGRESS' } }),
        prisma.maintenanceRequest.count({ where: { assignedToId: user.id, status: 'COMPLETED' } }),
        prisma.maintenanceRequest.count({ where: { assignedToId: user.id } })
      ]);

      return {
        role: 'MAINTENANCE_WORKER',
        assigned,
        inProgress,
        completed,
        total
      };
    }

    if (userRole === 'STORE_KEEPER') {
      const [pendingSpareParts, releasedSpareParts, totalSpareParts, totalRequests] = await Promise.all([
        prisma.requestSparePart.count({ where: { releasedAt: null } }),
        prisma.requestSparePart.count({ where: { releasedAt: { not: null } } }),
        prisma.requestSparePart.count(),
        prisma.maintenanceRequest.count()
      ]);

      return {
        role: 'STORE_KEEPER',
        pendingSpareParts,
        releasedSpareParts,
        totalSpareParts,
        total: totalRequests
      };
    }

    // SUPERVISOR or ADMIN
    const [total, submitted, assigned, inProgress, completed, rejected, aging, urgentPending] = await Promise.all([
      prisma.maintenanceRequest.count(),
      prisma.maintenanceRequest.count({ where: { status: 'SUBMITTED' } }),
      prisma.maintenanceRequest.count({ where: { status: 'ASSIGNED' } }),
      prisma.maintenanceRequest.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.maintenanceRequest.count({ where: { status: 'COMPLETED' } }),
      prisma.maintenanceRequest.count({ where: { status: 'REJECTED' } }),
      prisma.maintenanceRequest.count({
        where: {
          status: 'SUBMITTED',
          createdAt: { lt: twentyFourHoursAgo }
        }
      }),
      prisma.maintenanceRequest.count({
        where: {
          priority: 'Urgent',
          status: { in: ['SUBMITTED', 'ASSIGNED'] }
        }
      })
    ]);

    return {
      role: userRole,
      total,
      submitted,
      assigned,
      inProgress,
      completed,
      rejected,
      aging,
      urgentPending
    };
  }

  /**
   * Get active maintenance workers with their current workload
   */
  async getAssignableWorkers() {
    const workerRole = await prisma.role.findFirst({
      where: { name: 'MAINTENANCE_WORKER' }
    });

    if (!workerRole) {
      return [];
    }

    const workers = await prisma.user.findMany({
      where: {
        roleId: workerRole.id,
        isActive: true
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        department: {
          select: { name: true }
        },
        assignedToRequests: {
          where: {
            status: { in: ['ASSIGNED', 'IN_PROGRESS'] }
          },
          select: { id: true }
        }
      },
      orderBy: { displayName: 'asc' }
    });

    return workers.map((w) => ({
      id: w.id,
      username: w.username,
      displayName: w.displayName || w.username,
      email: w.email,
      department: w.department?.name || null,
      activeTasksCount: w.assignedToRequests.length
    }));
  }

  /**
   * Assign a request to a maintenance worker
   */
  async assignWorker(requestId, supervisorUser, workerId, expectedCurrentStatus = null) {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: Number(requestId) }
    });

    if (!request) {
      const err = new Error('Maintenance request not found');
      err.status = 404;
      throw err;
    }

    // Optimistic concurrency control
    if (expectedCurrentStatus && request.status !== expectedCurrentStatus) {
      const err = new Error('This request has been updated by another user. Please refresh and try again.');
      err.status = 409;
      throw err;
    }

    if (request.status === 'COMPLETED' || request.status === 'REJECTED') {
      const err = new Error(`Cannot assign worker to a ${request.status.toLowerCase()} request`);
      err.status = 400;
      throw err;
    }

    // Validate worker
    const worker = await prisma.user.findUnique({
      where: { id: Number(workerId) },
      include: { role: true }
    });

    if (!worker || !worker.isActive) {
      const err = new Error('Assigned worker not found or account is deactivated');
      err.status = 400;
      throw err;
    }

    if (worker.role?.name !== 'MAINTENANCE_WORKER' && worker.role?.name !== 'ADMIN') {
      const err = new Error('Assigned user must have the MAINTENANCE_WORKER role');
      err.status = 400;
      throw err;
    }

    const now = new Date();
    const updateData = {
      status: 'ASSIGNED',
      assignedToId: worker.id,
      assignedById: supervisorUser.id,
      assignedAt: now
    };

    // If Received By is not set yet, set it to the assigning supervisor
    if (!request.receivedById) {
      updateData.receivedById = supervisorUser.id;
      updateData.receivedAt = now;
    }

    // Update request
    const updatedRequest = await prisma.maintenanceRequest.update({
      where: { id: Number(requestId) },
      data: updateData
    });

    // Record in request_assignments
    await prisma.requestAssignment.upsert({
      where: {
        RequestAssignment_requestId_userId_key: {
          requestId: Number(requestId),
          userId: worker.id
        }
      },
      update: {
        assignedById: supervisorUser.id,
        assignedAt: now
      },
      create: {
        requestId: Number(requestId),
        userId: worker.id,
        assignedById: supervisorUser.id,
        assignedAt: now
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        requestId: Number(requestId),
        userId: supervisorUser.id,
        action: 'REQUEST_ASSIGNED',
        details: JSON.stringify({
          ticketNumber: request.ticketNumber,
          workerId: worker.id,
          workerName: worker.displayName || worker.username,
          assignedBy: supervisorUser.displayName || supervisorUser.username
        })
      }
    });

    return await this.getRequestById(requestId, supervisorUser);
  }

  /**
   * Reject a request with mandatory reason
   */
  async rejectRequest(requestId, supervisorUser, reason, expectedCurrentStatus = null) {
    if (!reason || !reason.trim()) {
      const err = new Error('Rejection reason is required');
      err.status = 400;
      throw err;
    }

    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: Number(requestId) }
    });

    if (!request) {
      const err = new Error('Maintenance request not found');
      err.status = 404;
      throw err;
    }

    // Optimistic concurrency control
    if (expectedCurrentStatus && request.status !== expectedCurrentStatus) {
      const err = new Error('This request has been updated by another user. Please refresh and try again.');
      err.status = 409;
      throw err;
    }

    if (request.status === 'COMPLETED' || request.status === 'REJECTED') {
      const err = new Error(`Request is already ${request.status.toLowerCase()}`);
      err.status = 400;
      throw err;
    }

    const now = new Date();
    const updateData = {
      status: 'REJECTED',
      rejectionReason: reason.trim(),
      rejectedById: supervisorUser.id,
      rejectedAt: now
    };

    if (!request.receivedById) {
      updateData.receivedById = supervisorUser.id;
      updateData.receivedAt = now;
    }

    await prisma.maintenanceRequest.update({
      where: { id: Number(requestId) },
      data: updateData
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        requestId: Number(requestId),
        userId: supervisorUser.id,
        action: 'REQUEST_REJECTED',
        details: JSON.stringify({
          ticketNumber: request.ticketNumber,
          reason: reason.trim(),
          rejectedBy: supervisorUser.displayName || supervisorUser.username
        })
      }
    });

    return await this.getRequestById(requestId, supervisorUser);
  }

  /**
   * Mark request as received by supervisor/manager
   */
  async receiveRequest(requestId, supervisorUser) {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: Number(requestId) }
    });

    if (!request) {
      const err = new Error('Maintenance request not found');
      err.status = 404;
      throw err;
    }

    if (request.receivedById) {
      return await this.getRequestById(requestId, supervisorUser);
    }

    const now = new Date();
    await prisma.maintenanceRequest.update({
      where: { id: Number(requestId) },
      data: {
        receivedById: supervisorUser.id,
        receivedAt: now
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        requestId: Number(requestId),
        userId: supervisorUser.id,
        action: 'REQUEST_RECEIVED',
        details: JSON.stringify({
          ticketNumber: request.ticketNumber,
          receivedBy: supervisorUser.displayName || supervisorUser.username
        })
      }
    });

    return await this.getRequestById(requestId, supervisorUser);
  }

  /**
   * Start work on a maintenance request (Worker / Supervisor / Admin)
   * Transitions status to IN_PROGRESS
   */
  async startWork(requestId, user, expectedCurrentStatus = null) {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: Number(requestId) },
      include: { assignments: true }
    });

    if (!request) {
      const err = new Error('Maintenance request not found');
      err.status = 404;
      throw err;
    }

    const userRole = user?.role?.name || (typeof user?.role === 'string' ? user.role : null);

    if (userRole === 'MAINTENANCE_WORKER') {
      const isAssigned = request.assignedToId === user.id || request.assignments.some((a) => a.userId === user.id);
      if (!isAssigned) {
        const err = new Error('You are not assigned to this maintenance request');
        err.status = 403;
        throw err;
      }
    } else if (!['SUPERVISOR', 'ADMIN'].includes(userRole)) {
      const err = new Error('You do not have permission to start work on maintenance requests');
      err.status = 403;
      throw err;
    }

    if (expectedCurrentStatus && request.status !== expectedCurrentStatus) {
      const err = new Error('This request has been updated by another user. Please refresh and try again.');
      err.status = 409;
      throw err;
    }

    if (request.status === 'COMPLETED' || request.status === 'REJECTED') {
      const err = new Error(`Cannot start work on a ${request.status.toLowerCase()} request`);
      err.status = 400;
      throw err;
    }

    const now = new Date();
    await prisma.maintenanceRequest.update({
      where: { id: Number(requestId) },
      data: {
        status: 'IN_PROGRESS',
        startedById: user.id,
        startedAt: now
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        requestId: Number(requestId),
        userId: user.id,
        action: 'WORK_STARTED',
        details: JSON.stringify({
          ticketNumber: request.ticketNumber,
          startedBy: user.displayName || user.username,
          startedAt: now
        })
      }
    });

    return await this.getRequestById(requestId, user);
  }

  /**
   * Complete work on a maintenance request (Worker / Supervisor / Admin)
   * Transitions status to COMPLETED and records action taken, maintenance time, and final report
   */
  async completeWork(requestId, user, { actionTaken, maintenanceTime, finalReport, expectedCurrentStatus = null }) {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: Number(requestId) },
      include: { assignments: true }
    });

    if (!request) {
      const err = new Error('Maintenance request not found');
      err.status = 404;
      throw err;
    }

    const userRole = user?.role?.name || (typeof user?.role === 'string' ? user.role : null);

    if (userRole === 'MAINTENANCE_WORKER') {
      const isAssigned = request.assignedToId === user.id || request.assignments.some((a) => a.userId === user.id);
      if (!isAssigned) {
        const err = new Error('You are not assigned to this maintenance request');
        err.status = 403;
        throw err;
      }
    } else if (!['SUPERVISOR', 'ADMIN'].includes(userRole)) {
      const err = new Error('You do not have permission to complete maintenance requests');
      err.status = 403;
      throw err;
    }

    if (expectedCurrentStatus && request.status !== expectedCurrentStatus) {
      const err = new Error('This request has been updated by another user. Please refresh and try again.');
      err.status = 409;
      throw err;
    }

    if (!actionTaken || !actionTaken.trim()) {
      const err = new Error('Action taken is required to complete the request');
      err.status = 400;
      throw err;
    }

    if (request.status === 'COMPLETED') {
      const err = new Error('This request is already marked as completed');
      err.status = 400;
      throw err;
    }

    if (request.status === 'REJECTED') {
      const err = new Error('Cannot complete a rejected request');
      err.status = 400;
      throw err;
    }

    const now = new Date();
    await prisma.maintenanceRequest.update({
      where: { id: Number(requestId) },
      data: {
        status: 'COMPLETED',
        actionTaken: actionTaken.trim(),
        maintenanceTime: maintenanceTime ? parseInt(maintenanceTime, 10) : null,
        finalReport: finalReport ? finalReport.trim() : null,
        completedById: user.id,
        completedAt: now
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        requestId: Number(requestId),
        userId: user.id,
        action: 'WORK_COMPLETED',
        details: JSON.stringify({
          ticketNumber: request.ticketNumber,
          completedBy: user.displayName || user.username,
          completedAt: now,
          actionTaken: actionTaken.trim(),
          maintenanceTime: maintenanceTime ? parseInt(maintenanceTime, 10) : null
        })
      }
    });

    return await this.getRequestById(requestId, user);
  }

  /**
   * Request spare parts for a ticket (Worker / Supervisor / Admin)
   */
  async requestSparePart(requestId, user, { partName, quantity, notes }) {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: Number(requestId) },
      include: { assignments: true }
    });

    if (!request) {
      const err = new Error('Maintenance request not found');
      err.status = 404;
      throw err;
    }

    const userRole = user?.role?.name || (typeof user?.role === 'string' ? user.role : null);

    if (userRole === 'MAINTENANCE_WORKER') {
      const isAssigned = request.assignedToId === user.id || request.assignments.some((a) => a.userId === user.id);
      if (!isAssigned) {
        const err = new Error('You are not assigned to this maintenance request');
        err.status = 403;
        throw err;
      }
    } else if (!['SUPERVISOR', 'ADMIN', 'STORE_KEEPER'].includes(userRole)) {
      const err = new Error('You do not have permission to request spare parts');
      err.status = 403;
      throw err;
    }

    if (!['ASSIGNED', 'IN_PROGRESS'].includes(request.status)) {
      const err = new Error(`Cannot request spare parts for a request with status ${request.status}`);
      err.status = 400;
      throw err;
    }

    if (!partName || !partName.trim()) {
      const err = new Error('Part name is required');
      err.status = 400;
      throw err;
    }

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      const err = new Error('Quantity must be a positive integer');
      err.status = 400;
      throw err;
    }

    const sparePart = await prisma.requestSparePart.create({
      data: {
        requestId: Number(requestId),
        partName: partName.trim(),
        quantity: parsedQty,
        requestedById: user.id,
        notes: notes ? notes.trim() : null
      },
      include: {
        requestedBy: { select: { id: true, username: true, displayName: true } }
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        requestId: Number(requestId),
        userId: user.id,
        action: 'SPARE_PART_REQUESTED',
        details: JSON.stringify({
          ticketNumber: request.ticketNumber,
          partName: partName.trim(),
          quantity: parsedQty,
          requestedBy: user.displayName || user.username
        })
      }
    });

    return sparePart;
  }

  /**
   * List spare parts with optional filtering (status = 'PENDING' | 'RELEASED', requestId)
   */
  async getSpareParts(filters = {}) {
    const where = {};

    if (filters.requestId) {
      where.requestId = Number(filters.requestId);
    }

    if (filters.status === 'PENDING') {
      where.releasedAt = null;
    } else if (filters.status === 'RELEASED') {
      where.releasedAt = { not: null };
    }

    return await prisma.requestSparePart.findMany({
      where,
      include: {
        request: {
          select: {
            id: true,
            ticketNumber: true,
            description: true,
            location: true,
            status: true,
            priority: true
          }
        },
        requestedBy: {
          select: { id: true, username: true, displayName: true }
        },
        releasedBy: {
          select: { id: true, username: true, displayName: true }
        }
      },
      orderBy: { id: 'desc' }
    });
  }

  /**
   * Release a requested spare part (Storekeeper / Supervisor / Admin)
   */
  async releaseSparePart(partId, user, { notes } = {}) {
    const part = await prisma.requestSparePart.findUnique({
      where: { id: Number(partId) },
      include: { request: true }
    });

    if (!part) {
      const err = new Error('Spare part request not found');
      err.status = 404;
      throw err;
    }

    if (part.releasedAt) {
      const err = new Error('This spare part has already been released');
      err.status = 400;
      throw err;
    }

    const userRole = user?.role?.name || (typeof user?.role === 'string' ? user.role : null);
    if (!['STORE_KEEPER', 'SUPERVISOR', 'ADMIN'].includes(userRole)) {
      const err = new Error('Only storekeepers or supervisors can release spare parts');
      err.status = 403;
      throw err;
    }

    const now = new Date();
    let updatedNotes = part.notes;
    if (notes && notes.trim()) {
      updatedNotes = updatedNotes ? `${updatedNotes} | Release: ${notes.trim()}` : `Release: ${notes.trim()}`;
    }

    const updated = await prisma.requestSparePart.update({
      where: { id: Number(partId) },
      data: {
        releasedById: user.id,
        releasedAt: now,
        notes: updatedNotes
      },
      include: {
        request: {
          select: {
            id: true,
            ticketNumber: true,
            description: true,
            location: true,
            status: true
          }
        },
        requestedBy: { select: { id: true, username: true, displayName: true } },
        releasedBy: { select: { id: true, username: true, displayName: true } }
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        requestId: part.requestId,
        userId: user.id,
        action: 'SPARE_PART_RELEASED',
        details: JSON.stringify({
          ticketNumber: part.request?.ticketNumber,
          partName: part.partName,
          quantity: part.quantity,
          releasedBy: user.displayName || user.username
        })
      }
    });

    return updated;
  }
}

module.exports = new RequestService();
