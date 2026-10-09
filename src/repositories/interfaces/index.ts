import type { Repository } from "./Repository";
import type {
  Activity, Attachment, Client, Comment, Expense, Notification, Payment, Project, ProjectMember,
  Subtask, Task, TaskAssignee, TimeEntry, User,
} from "@/schemas/entities";

export type { Repository, NewEntity } from "./Repository";

export type UserRepository = Repository<User>;
export type ClientRepository = Repository<Client>;
export type ProjectRepository = Repository<Project>;
export type ProjectMemberRepository = Repository<ProjectMember>;
export type TaskRepository = Repository<Task>;
export type TaskAssigneeRepository = Repository<TaskAssignee> & {
  /** Atomically replace a task's primary owner + contributors. */
  replaceForTask(taskId: string, primary: string | null, contributors: string[]): Promise<TaskAssignee[]>;
};
export type SubtaskRepository = Repository<Subtask>;
export type TimeEntryRepository = Repository<TimeEntry>;
export type ExpenseRepository = Repository<Expense>;
export type PaymentRepository = Repository<Payment>;
export type CommentRepository = Repository<Comment>;
export type NotificationRepository = Repository<Notification> & {
  markAllRead(userId: string): Promise<number>;
};
export type ActivityRepository = Repository<Activity>;
export type AttachmentRepository = Repository<Attachment>;

export interface Repositories {
  users: UserRepository;
  clients: ClientRepository;
  projects: ProjectRepository;
  projectMembers: ProjectMemberRepository;
  tasks: TaskRepository;
  taskAssignees: TaskAssigneeRepository;
  subtasks: SubtaskRepository;
  timeEntries: TimeEntryRepository;
  expenses: ExpenseRepository;
  payments: PaymentRepository;
  comments: CommentRepository;
  notifications: NotificationRepository;
  activity: ActivityRepository;
  attachments: AttachmentRepository;
}

/** Bulk operations used by backup/restore/import. A Postgres implementation would use transactions. */
export interface StorageAdmin {
  readAll(name: string): Promise<unknown[]>;
  replaceAll(name: string, rows: unknown[]): Promise<void>;
}
