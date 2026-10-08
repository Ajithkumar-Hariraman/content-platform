import type { Role } from './types.js';
export const permissions = [
  'PRODUCT_READ',
  'PRODUCT_WRITE',
  'PRODUCT_DELETE',
  'CONTENT_READ',
  'CONTENT_WRITE',
  'CONTENT_PUBLISH',
  'CONTENT_DELETE',
  'ACTIVITY_READ',
  'USER_READ',
  'USER_WRITE',
] as const;
export type Permission = (typeof permissions)[number];
const read: Permission[] = ['PRODUCT_READ', 'CONTENT_READ', 'ACTIVITY_READ'];
export const rolePermissions: Readonly<Record<Role, readonly Permission[]>> = {
  VIEWER: read,
  EDITOR: [...read, 'PRODUCT_WRITE', 'CONTENT_WRITE', 'CONTENT_PUBLISH'],
  ADMIN: permissions,
};
