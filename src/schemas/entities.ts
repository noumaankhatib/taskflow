import { z } from "zod";
import {
  Currency,
  PaymentMethod,
  Priority,
  amount,
  baseFields,
  dateString,
  idOf,
  positiveAmount,
  requiredText,
  softDeleteFields,
  timestamp,
} from "./common";

/* ------------------------------ enums ------------------------------ */
export const ROLES = ["ADMIN", "PROJECT_MANAGER", "DEVELOPER", "DESIGNER", "QA", "FINANCE", "VIEWER"] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export const ProjectStatus = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

export const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED", "CANCELLED"] as const;
export const TaskStatus = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TASK_TYPES = ["TASK", "BUG", "ISSUE"] as const;
export const TaskType = z.enum(TASK_TYPES);
export type TaskType = z.infer<typeof TaskType>;

export const EXPENSE_CATEGORIES = [
  "HOSTING", "DOMAIN", "SOFTWARE", "API", "DESIGN", "MARKETING", "TRAVEL", "HARDWARE", "TEAM", "MISCELLANEOUS",
] as const;
export const ExpenseCategory = z.enum(EXPENSE_CATEGORIES);
export type ExpenseCategory = z.infer<typeof ExpenseCategory>;

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const ApprovalStatus = z.enum(APPROVAL_STATUSES);
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

export const PAYMENT_STATUSES = ["PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"] as const;
export const PaymentStatus = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const NOTIFICATION_TYPES = [
  "TASK_ASSIGNED", "TASK_UPDATED", "TASK_COMPLETED", "TASK_OVERDUE", "MENTION", "COMMENT", "PROJECT_UPDATE",
  "EXPENSE_ADDED", "EXPENSE_APPROVED", "PAYMENT_RECEIVED", "PAYMENT_PENDING", "SYSTEM_ALERT", "SUCCESS",
  "WARNING", "ERROR", "APPROVAL_REQUIRED",
] as const;
export const NotificationType = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof NotificationType>;

export const SEVERITIES = ["INFO", "SUCCESS", "WARNING", "ERROR"] as const;
export const Severity = z.enum(SEVERITIES);
export type Severity = z.infer<typeof Severity>;

export const ENTITY_TYPES = [
  "USER", "CLIENT", "PROJECT", "TASK", "SUBTASK", "COMMENT", "TIME_ENTRY", "EXPENSE", "PAYMENT", "ATTACHMENT", "SYSTEM",
] as const;
export const EntityType = z.enum(ENTITY_TYPES);
export type EntityType = z.infer<typeof EntityType>;

export const ACTIVITY_ACTIONS = [
  "CREATED", "UPDATED", "DELETED", "RESTORED", "STATUS_CHANGED", "ASSIGNMENT_CHANGED", "EXPENSE_ADDED",
  "PAYMENT_ADDED", "COMMENT_ADDED", "TIME_LOGGED", "APPROVED", "REJECTED", "FILE_UPLOADED", "BACKUP", "RESTORED_BACKUP",
] as const;
export const ActivityAction = z.enum(ACTIVITY_ACTIONS);
export type ActivityAction = z.infer<typeof ActivityAction>;

/* ------------------------------ entities ------------------------------ */
export const UserSchema = z.object({
  id: idOf("USR"),
  name: requiredText("Name", 100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: Role,
  avatar: z.string().nullable().default(null), // URL or null (initials are rendered)
  hourlyRate: amount.default(0),
  dailyRate: amount.default(0),
  active: z.boolean().default(true),
  passwordHash: z.string().min(20),
  ...softDeleteFields,
  ...baseFields,
});
export type User = z.infer<typeof UserSchema>;
export type PublicUser = Omit<User, "passwordHash">;

export const ClientSchema = z.object({
  id: idOf("CLI"),
  companyName: requiredText("Company name"),
  contactPerson: z.string().trim().max(100).default(""),
  email: z.string().trim().email("Enter a valid email address").or(z.literal("")).default(""),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(2000).default(""),
  active: z.boolean().default(true),
  ...baseFields,
});
export type Client = z.infer<typeof ClientSchema>;

export const ProjectSchema = z.object({
  id: idOf("PRJ"),
  name: requiredText("Project name"),
  clientId: idOf("CLI"),
  description: z.string().trim().max(5000).default(""),
  status: ProjectStatus,
  priority: Priority,
  startDate: dateString.nullable().default(null),
  expectedEndDate: dateString.nullable().default(null),
  actualEndDate: dateString.nullable().default(null),
  budget: amount.default(0),
  contractValue: amount.default(0),
  createdBy: idOf("USR"),
  projectManagerId: idOf("USR").nullable().default(null),
  ...softDeleteFields,
  ...baseFields,
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectMemberSchema = z.object({
  id: idOf("PMB"),
  projectId: idOf("PRJ"),
  userId: idOf("USR"),
  ...baseFields,
});
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;

export const TaskSchema = z.object({
  id: idOf("TASK"),
  projectId: idOf("PRJ"),
  title: requiredText("Title"),
  description: z.string().trim().max(10000).default(""),
  type: TaskType.default("TASK"),
  status: TaskStatus,
  priority: Priority,
  startDate: dateString.nullable().default(null),
  dueDate: dateString.nullable().default(null),
  estimatedHours: z.number().finite().min(0).default(0),
  tags: z.array(z.string().trim().min(1).max(40)).default([]),
  parentTaskId: idOf("TASK").nullable().default(null),
  createdBy: idOf("USR"),
  completedAt: timestamp.nullable().default(null),
  ...softDeleteFields,
  ...baseFields,
});
export type Task = z.infer<typeof TaskSchema>;

export const ASSIGNEE_ROLES = ["PRIMARY", "CONTRIBUTOR"] as const;
export const TaskAssigneeSchema = z.object({
  id: idOf("TAS"),
  taskId: idOf("TASK"),
  userId: idOf("USR"),
  role: z.enum(ASSIGNEE_ROLES),
  ...baseFields,
});
export type TaskAssignee = z.infer<typeof TaskAssigneeSchema>;

export const SubtaskSchema = z.object({
  id: idOf("SUB"),
  taskId: idOf("TASK"),
  title: requiredText("Subtask title"),
  completed: z.boolean().default(false),
  completedAt: timestamp.nullable().default(null),
  ...baseFields,
});
export type Subtask = z.infer<typeof SubtaskSchema>;

export const TimeEntrySchema = z.object({
  id: idOf("TIME"),
  taskId: idOf("TASK"),
  projectId: idOf("PRJ"),
  userId: idOf("USR"),
  date: dateString,
  hours: z.number().finite().gt(0, "Hours must be greater than zero").max(24, "Hours cannot exceed 24 per entry"),
  description: z.string().trim().max(1000).default(""),
  billable: z.boolean().default(true),
  ...baseFields,
});
export type TimeEntry = z.infer<typeof TimeEntrySchema>;

export const ExpenseSchema = z.object({
  id: idOf("EXP"),
  projectId: idOf("PRJ"),
  category: ExpenseCategory,
  description: requiredText("Description", 300),
  amount: positiveAmount,
  currency: Currency.default("INR"),
  date: dateString,
  paidBy: idOf("USR"),
  paymentMethod: PaymentMethod,
  attachmentId: idOf("ATT").nullable().default(null),
  notes: z.string().trim().max(2000).default(""),
  approvalStatus: z.enum(APPROVAL_STATUSES).default("APPROVED"),
  approvedBy: idOf("USR").nullable().default(null),
  createdBy: idOf("USR"),
  ...softDeleteFields,
  ...baseFields,
});
export type Expense = z.infer<typeof ExpenseSchema>;

export const PaymentSchema = z.object({
  id: idOf("PAY"),
  projectId: idOf("PRJ"),
  clientId: idOf("CLI"),
  invoiceNumber: requiredText("Invoice number", 60),
  amount: positiveAmount,
  receivedAmount: amount.default(0),
  currency: Currency.default("INR"),
  paymentDate: dateString.nullable().default(null), // date received
  dueDate: dateString.nullable().default(null),
  paymentMethod: PaymentMethod.nullable().default(null),
  status: PaymentStatus,
  notes: z.string().trim().max(2000).default(""),
  createdBy: idOf("USR"),
  ...softDeleteFields,
  ...baseFields,
});
export type Payment = z.infer<typeof PaymentSchema>;

export const CommentSchema = z.object({
  id: idOf("CMT"),
  taskId: idOf("TASK"),
  userId: idOf("USR"),
  message: requiredText("Comment", 5000),
  ...baseFields,
});
export type Comment = z.infer<typeof CommentSchema>;

export const NotificationSchema = z.object({
  id: idOf("NTF"),
  userId: idOf("USR"),
  type: NotificationType,
  title: requiredText("Title", 200),
  message: z.string().max(1000).default(""),
  severity: Severity.default("INFO"),
  entityType: z.string().nullable().default(null), // generic: any module can use any string
  entityId: z.string().nullable().default(null),
  isRead: z.boolean().default(false),
  ...baseFields,
});
export type Notification = z.infer<typeof NotificationSchema>;

export const ActivitySchema = z.object({
  id: idOf("ACT"),
  entityType: EntityType,
  entityId: z.string(),
  projectId: z.string().nullable().default(null),
  action: ActivityAction,
  userId: z.string(),
  oldValue: z.unknown().nullable().default(null),
  newValue: z.unknown().nullable().default(null),
  message: z.string().default(""),
  ...baseFields,
});
export type Activity = z.infer<typeof ActivitySchema>;

export const AttachmentSchema = z.object({
  id: idOf("ATT"),
  entityType: z.enum(["PROJECT", "TASK", "EXPENSE"]),
  entityId: z.string(),
  projectId: idOf("PRJ"),
  fileName: requiredText("File name", 255),
  mimeType: z.string().max(150),
  size: z.number().int().min(0),
  storedName: z.string(),
  uploadedBy: idOf("USR"),
  ...softDeleteFields,
  ...baseFields,
});
export type Attachment = z.infer<typeof AttachmentSchema>;

/** Every JSON file → its row schema + id prefix. Single source of truth for storage + backup validation. */
export const COLLECTIONS = {
  users: { file: "users.json", schema: UserSchema, prefix: "USR" },
  clients: { file: "clients.json", schema: ClientSchema, prefix: "CLI" },
  projects: { file: "projects.json", schema: ProjectSchema, prefix: "PRJ" },
  projectMembers: { file: "project-members.json", schema: ProjectMemberSchema, prefix: "PMB" },
  tasks: { file: "tasks.json", schema: TaskSchema, prefix: "TASK" },
  taskAssignees: { file: "task-assignees.json", schema: TaskAssigneeSchema, prefix: "TAS" },
  subtasks: { file: "subtasks.json", schema: SubtaskSchema, prefix: "SUB" },
  timeEntries: { file: "time-entries.json", schema: TimeEntrySchema, prefix: "TIME" },
  expenses: { file: "expenses.json", schema: ExpenseSchema, prefix: "EXP" },
  payments: { file: "payments.json", schema: PaymentSchema, prefix: "PAY" },
  comments: { file: "comments.json", schema: CommentSchema, prefix: "CMT" },
  notifications: { file: "notifications.json", schema: NotificationSchema, prefix: "NTF" },
  activity: { file: "activity.json", schema: ActivitySchema, prefix: "ACT" },
  attachments: { file: "attachments.json", schema: AttachmentSchema, prefix: "ATT" },
} as const;
export type CollectionName = keyof typeof COLLECTIONS;
