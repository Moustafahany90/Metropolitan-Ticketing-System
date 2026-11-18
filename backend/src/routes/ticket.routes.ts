import { Router } from "express";
import * as ticketController from "../controllers/ticket.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/authorize.middleware";
import { validate } from "../middleware/validate.middleware";
import { createTicketSchema, idParamsSchema, listTicketsQuerySchema, updateStatusSchema } from "../schemas/ticket.schema";
import { assignSchema } from "../schemas/comment.schema";

const router = Router();

router.use(requireAuth);

router.get("/", validate(listTicketsQuerySchema, "query"), ticketController.listTickets);
router.post("/", validate(createTicketSchema), ticketController.createTicket);
router.get("/:id", validate(idParamsSchema, "params"), ticketController.getTicketById);
router.patch(
  "/:id/status",
  validate(idParamsSchema, "params"),
  validate(updateStatusSchema),
  requireRole("TECHNICIAN"),
  ticketController.updateTicketStatus
);
router.patch(
  "/:id/assign",
  validate(idParamsSchema, "params"),
  validate(assignSchema),
  requireRole("TECHNICIAN"),
  ticketController.assignTicket
);

export default router;
