import express from "express";
import cors from "cors";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import healthRoutes from "./routes/health.routes";
import ticketRoutes from "./routes/ticket.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import commentRoutes from "./routes/comment.routes";
import departmentRoutes from "./routes/department.routes";
import categoryRoutes from "./routes/category.routes";
import userRoutes from "./routes/user.routes";
import { errorHandler, notFound } from "./middleware/error.middleware";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",") : true,
  })
);
app.use(express.json());

app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tickets", commentRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
