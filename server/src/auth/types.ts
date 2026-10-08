export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export interface User {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}
export interface CredentialUser extends User {
  passwordHash: string;
}
export interface Principal {
  user: User;
  sessionId: string;
  csrfTokenHash: string;
}
declare module 'express-serve-static-core' {
  interface Request {
    principal?: Principal;
  }
}
