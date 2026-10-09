import { z } from "zod";
import { Currency, PaymentMethod, Priority, amount, dateString, idOf, positiveAmount, requiredText } from "./common";
import {
  ExpenseCategory, PaymentStatus, ProjectStatus, Role, TaskStatus, TaskType, NotificationType, Severity,
} from "./entities";

const emptyToNull = (v: unknown) => (v === "" ? null : v);
const optDate = z.preprocess(emptyToNull, dateString.nullable().optional());
const optId = (p: string) => z.preprocess(emptyToNull, idOf(p).nullable().optional());

const dateOrder = (a: string, b: string, msg: string) => (v: Record<string, unknown>, ctx: z.RefinementCtx) => {
  const x = v[a] as string | null | undefined;
  const y = v[b] as string | null | undefined;
  if (x && y && x > y) ctx.addIssue({ code: "custom", path: [b], message: msg });
};

/**
 * PATCH-style schema: every field optional and NO defaults. (`.partial()` alone keeps `.default()`s,
 * which would silently reset untouched fields to their defaults on update.)
 */
function patchOf<T extends z.ZodObject>(obj: T) {
  const shape: Record<string, z.ZodType> = {};
  for (const [k, v] of Object.entries(obj.shape) as [string, z.ZodType][]) {
    shape[k] = (v instanceof z.ZodDefault ? (v.unwrap() as z.ZodType) : v).optional();
  }
  return z.object(shape) as unknown as z.ZodObject<{ [K in keyof T["shape"]]: z.ZodOptional<z.ZodType<z.output<T["shape"][K]>>> }>;
}

export const password = z.string().min(8, "Password must be at least 8 characters").max(128);

/* ------------------------------ auth / users ------------------------------ */
export const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const UserCreateInput = z.object({
  name: requiredText("Name", 100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: Role,
  hourlyRate: amount.default(0),
  dailyRate: amount.default(0),
  password,
});
export const UserUpdateInput = z
  .object({
    name: requiredText("Name", 100),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    role: Role,
    hourlyRate: amount,
    dailyRate: amount,
    active: z.boolean(),
    avatar: z.string().max(500).nullable(),
  })
  .partial();
export const ResetPasswordInput = z.object({ newPassword: password });
export const ChangePasswordInput = z.object({ currentPassword: z.string().min(1, "Current password is required"), newPassword: password });

/* ------------------------------ clients ------------------------------ */
export const ClientInput = z.object({
  companyName: requiredText("Company name"),
  contactPerson: z.string().trim().max(100).default(""),
  email: z.string().trim().email("Enter a valid email address").or(z.literal("")).default(""),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(2000).default(""),
  active: z.boolean().default(true),
});
export const ClientUpdateInput = patchOf(ClientInput);

/* ------------------------------ projects ------------------------------ */
const projectBase = z.object({
  name: requiredText("Project name"),
  clientId: idOf("CLI"),
  description: z.string().trim().max(5000).default(""),
  status: ProjectStatus.default("PLANNING"),
  priority: Priority.default("MEDIUM"),
  startDate: optDate,
  expectedEndDate: optDate,
  actualEndDate: optDate,
  budget: amount.default(0),
  contractValue: amount.default(0),
  projectManagerId: optId("USR"),
  memberIds: z.array(idOf("USR")).default([]),
});
const projectDates = dateOrder("startDate", "expectedEndDate", "Expected end date cannot be before start date");
export const ProjectCreateInput = projectBase.superRefine(projectDates);
export const ProjectUpdateInput = patchOf(projectBase).superRefine(projectDates);

/* ------------------------------ tasks ------------------------------ */
const taskBase = z.object({
  projectId: idOf("PRJ"),
  title: requiredText("Title"),
  description: z.string().trim().max(10000).default(""),
  type: TaskType.default("TASK"),
  status: TaskStatus.default("TODO"),
  priority: Priority.default("MEDIUM"),
  startDate: optDate,
  dueDate: optDate,
  estimatedHours: z.number().finite().min(0, "Estimated hours cannot be negative").default(0),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  parentTaskId: optId("TASK"),
  primaryOwnerId: optId("USR"),
  contributorIds: z.array(idOf("USR")).default([]),
});
const taskDates = dateOrder("startDate", "dueDate", "Due date cannot be before start date");
export const TaskCreateInput = taskBase.superRefine(taskDates);
export const TaskUpdateInput = patchOf(taskBase.omit({ projectId: true })).superRefine(taskDates);

export const SubtaskCreateInput = z.object({ title: requiredText("Subtask title") });
export const SubtaskUpdateInput = z.object({ title: requiredText("Subtask title").optional(), completed: z.boolean().optional() });
export const CommentInput = z.object({ message: requiredText("Comment", 5000) });

export const TimeEntryInput = z.object({
  taskId: idOf("TASK"),
  date: dateString,
  hours: z.number({ error: "Hours must be a number" }).finite().gt(0, "Hours must be greater than zero").max(24, "Hours cannot exceed 24 per entry"),
  description: z.string().trim().max(1000).default(""),
  billable: z.boolean().default(true),
  userId: idOf("USR").optional(),
});
export const TimeEntryUpdateInput = patchOf(TimeEntryInput.omit({ taskId: true, userId: true }));

/* ------------------------------ money ------------------------------ */
const expenseBase = z.object({
  projectId: idOf("PRJ"),
  category: ExpenseCategory,
  description: requiredText("Description", 300),
  amount: positiveAmount,
  currency: Currency.default("INR"),
  date: dateString,
  paidBy: idOf("USR"),
  paymentMethod: PaymentMethod,
  attachmentId: optId("ATT"),
  notes: z.string().trim().max(2000).default(""),
});
export const ExpenseCreateInput = expenseBase;
export const ExpenseUpdateInput = patchOf(expenseBase);
export const ExpenseDecisionInput = z.object({ decision: z.enum(["APPROVED", "REJECTED"]) });

const paymentBase = z.object({
  projectId: idOf("PRJ"),
  invoiceNumber: requiredText("Invoice number", 60),
  amount: positiveAmount,
  receivedAmount: amount.default(0),
  currency: Currency.default("INR"),
  paymentDate: optDate,
  dueDate: optDate,
  paymentMethod: z.preprocess(emptyToNull, PaymentMethod.nullable().optional()),
  status: PaymentStatus.default("PENDING"),
  notes: z.string().trim().max(2000).default(""),
});
export const PaymentCreateInput = paymentBase;
export const PaymentUpdateInput = patchOf(paymentBase.omit({ projectId: true }));

/* ------------------------------ misc ------------------------------ */
export const NotificationCreateInput = z.object({
  userId: idOf("USR"),
  type: NotificationType,
  title: requiredText("Title", 200),
  message: z.string().max(1000).default(""),
  severity: Severity.default("INFO"),
  entityType: z.string().nullable().default(null),
  entityId: z.string().nullable().default(null),
});

export const RestoreInput = z.object({ name: z.string().regex(/^[\w.-]+$/, "Invalid backup name") });
