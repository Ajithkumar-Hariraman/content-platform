export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'CloudOps Content Platform API',
    version: '1.0.0',
    description:
      'Cookie-authenticated administrative APIs, public catalog/CMS reads, and asynchronous activity delivery. Roles map to permissions centrally; authenticated mutations require a session-bound CSRF header. Pagination parameters are encoded as query strings.',
  },
  servers: [
    {
      url: '/',
    },
  ],
  paths: {
    '/api/v1/admin/diagnostics/performance': {
      get: {
        summary: 'Read process-local performance diagnostics',
        operationId: 'get_admin_performance',
        tags: ['operations'],
        security: [{ sessionCookie: [] }],
        'x-required-permission': 'USER_WRITE',
        responses: {
          '200': {
            description:
              'No-store counters, cumulative duration histograms, pool and process resource statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['metrics', 'process'],
                  properties: {
                    metrics: { type: 'object', additionalProperties: true },
                    pool: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        idle: { type: 'integer' },
                        waiting: { type: 'integer' },
                        max: { type: 'integer' },
                      },
                    },
                    process: { type: 'object', additionalProperties: true },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '403': {
            description: 'Administrative permission required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        summary: 'Create a new session',
        operationId: 'post_auth_login',
        tags: ['auth'],
        security: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthSession',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'Generic failure for invalid credentials and disabled users. Requires JSON; cross-origin requests must match CLIENT_ORIGIN. Sets HttpOnly session and CSRF companion cookies. Production uses Secure __Host- names; development uses localhost HTTP cookies. Session cookie is never returned in JSON.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Login',
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        summary: 'Read current user, permissions and session CSRF token',
        operationId: 'get_auth_me',
        tags: ['auth'],
        security: [
          {
            sessionCookie: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthSession',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        summary: 'Revoke session and clear cookies',
        operationId: 'post_auth_logout',
        tags: ['auth'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '204': {
            description: 'No content',
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/change-password': {
      post: {
        summary: 'Change password and revoke all user sessions',
        operationId: 'post_auth_change_password',
        tags: ['auth'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '204': {
            description: 'No content',
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'Requires current password and CSRF token; sign in again after success.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PasswordChange',
              },
            },
          },
        },
      },
    },
    '/api/v1/admin/users': {
      get: {
        summary: 'List users',
        operationId: 'get_admin_users',
        tags: ['users'],
        security: [
          {
            sessionCookie: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserPage',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 1000000,
              default: 1,
            },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
        ],
        'x-required-permission': 'USER_READ',
      },
      post: {
        summary: 'Create user',
        operationId: 'post_admin_users',
        tags: ['users'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '201': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateUser',
              },
            },
          },
        },
        'x-required-permission': 'USER_WRITE',
      },
    },
    '/api/v1/admin/users/{id}/role': {
      patch: {
        summary: 'Change user role',
        operationId: 'patch_admin_users_id_role',
        tags: ['users'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'Revokes all sessions on a change. The last active administrator cannot be disabled or demoted.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RoleInput',
              },
            },
          },
        },
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        'x-required-permission': 'USER_WRITE',
      },
    },
    '/api/v1/admin/users/{id}/status': {
      patch: {
        summary: 'Change user status',
        operationId: 'patch_admin_users_id_status',
        tags: ['users'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'Revokes all sessions on a change. The last active administrator cannot be disabled or demoted.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/StatusInput',
              },
            },
          },
        },
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        'x-required-permission': 'USER_WRITE',
      },
    },
    '/api/v1/products': {
      get: {
        summary: 'List products',
        operationId: 'get_products',
        tags: ['products'],
        security: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ProductPage',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 1000000,
              default: 1,
            },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 10,
            },
          },
          {
            name: 'search',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              maxLength: 200,
            },
          },
          {
            name: 'categoryId',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['DRAFT', 'ACTIVE', 'INACTIVE'],
            },
          },
          {
            name: 'sort',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['createdAt', 'name', 'price'],
              default: 'createdAt',
            },
          },
          {
            name: 'order',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
            },
          },
        ],
      },
      post: {
        summary: 'Maintain product',
        operationId: 'post_products',
        tags: ['products'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '201': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ProductResponse',
                },
              },
            },
            headers: {
              Location: {
                description: 'Created resource URL',
                schema: {
                  type: 'string',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'Legacy /products mutations have the same authentication, CSRF and permission requirements as /admin/products.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ProductInput',
              },
            },
          },
        },
        'x-required-permission': 'PRODUCT_WRITE',
      },
    },
    '/api/v1/products/{id}': {
      get: {
        summary: 'Read product',
        operationId: 'get_products_id',
        tags: ['products'],
        security: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ProductResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
      },
      patch: {
        summary: 'Maintain product',
        operationId: 'patch_products_id',
        tags: ['products'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ProductResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'Legacy /products mutations have the same authentication, CSRF and permission requirements as /admin/products.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ProductUpdate',
              },
            },
          },
        },
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        'x-required-permission': 'PRODUCT_WRITE',
      },
      delete: {
        summary: 'Maintain product',
        operationId: 'delete_products_id',
        tags: ['products'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '204': {
            description: 'No content',
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'Legacy /products mutations have the same authentication, CSRF and permission requirements as /admin/products.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        'x-required-permission': 'PRODUCT_DELETE',
      },
    },
    '/api/v1/admin/products': {
      get: {
        summary: 'List products',
        operationId: 'get_admin_products',
        tags: ['products'],
        security: [
          {
            sessionCookie: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ProductPage',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 1000000,
              default: 1,
            },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 10,
            },
          },
          {
            name: 'search',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              maxLength: 200,
            },
          },
          {
            name: 'categoryId',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['DRAFT', 'ACTIVE', 'INACTIVE'],
            },
          },
          {
            name: 'sort',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['createdAt', 'name', 'price'],
              default: 'createdAt',
            },
          },
          {
            name: 'order',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
            },
          },
        ],
        'x-required-permission': 'PRODUCT_READ',
      },
      post: {
        summary: 'Maintain product',
        operationId: 'post_admin_products',
        tags: ['products'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '201': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ProductResponse',
                },
              },
            },
            headers: {
              Location: {
                description: 'Created resource URL',
                schema: {
                  type: 'string',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'Legacy /products mutations have the same authentication, CSRF and permission requirements as /admin/products.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ProductInput',
              },
            },
          },
        },
        'x-required-permission': 'PRODUCT_WRITE',
      },
    },
    '/api/v1/admin/products/{id}': {
      get: {
        summary: 'Read product',
        operationId: 'get_admin_products_id',
        tags: ['products'],
        security: [
          {
            sessionCookie: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ProductResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        'x-required-permission': 'PRODUCT_READ',
      },
      patch: {
        summary: 'Maintain product',
        operationId: 'patch_admin_products_id',
        tags: ['products'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ProductResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'Legacy /products mutations have the same authentication, CSRF and permission requirements as /admin/products.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ProductUpdate',
              },
            },
          },
        },
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        'x-required-permission': 'PRODUCT_WRITE',
      },
      delete: {
        summary: 'Maintain product',
        operationId: 'delete_admin_products_id',
        tags: ['products'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '204': {
            description: 'No content',
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'Legacy /products mutations have the same authentication, CSRF and permission requirements as /admin/products.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        'x-required-permission': 'PRODUCT_DELETE',
      },
    },
    '/api/v1/categories': {
      get: {
        summary: 'List categories',
        operationId: 'get_categories',
        tags: ['categories'],
        security: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Categories',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/content': {
      get: {
        summary: 'List published content',
        operationId: 'get_content',
        tags: ['content'],
        security: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ContentPage',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 1000000,
              default: 1,
            },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 10,
            },
          },
          {
            name: 'search',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              maxLength: 200,
            },
          },
          {
            name: 'sort',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['publishedAt', 'title'],
              default: 'publishedAt',
            },
          },
          {
            name: 'order',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
            },
          },
        ],
      },
    },
    '/api/v1/content/{slug}': {
      get: {
        summary: 'Read published content',
        operationId: 'get_content_slug',
        tags: ['content'],
        security: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ContentResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description: 'Missing, draft and archived slugs all return 404.',
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              minLength: 1,
              maxLength: 200,
              pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
            },
          },
        ],
      },
    },
    '/api/v1/admin/content': {
      get: {
        summary: 'List editorial content',
        operationId: 'get_admin_content',
        tags: ['content'],
        security: [
          {
            sessionCookie: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ContentPage',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 1000000,
              default: 1,
            },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 10,
            },
          },
          {
            name: 'search',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              maxLength: 200,
            },
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
            },
          },
          {
            name: 'sort',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['createdAt', 'publishedAt', 'title'],
              default: 'createdAt',
            },
          },
          {
            name: 'order',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
            },
          },
        ],
        'x-required-permission': 'CONTENT_READ',
      },
      post: {
        summary: 'Create draft',
        operationId: 'post_admin_content',
        tags: ['content'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '201': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ContentResponse',
                },
              },
            },
            headers: {
              Location: {
                description: 'Created resource URL',
                schema: {
                  type: 'string',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ContentInput',
              },
            },
          },
        },
        'x-required-permission': 'CONTENT_WRITE',
      },
    },
    '/api/v1/admin/content/{id}': {
      get: {
        summary: 'Read editorial content',
        operationId: 'get_admin_content_id',
        tags: ['content'],
        security: [
          {
            sessionCookie: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ContentResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        'x-required-permission': 'CONTENT_READ',
      },
      patch: {
        summary: 'Edit editorial fields',
        operationId: 'patch_admin_content_id',
        tags: ['content'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ContentResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ContentUpdate',
              },
            },
          },
        },
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        'x-required-permission': 'CONTENT_WRITE',
      },
      delete: {
        summary: 'Delete content',
        operationId: 'delete_admin_content_id',
        tags: ['content'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '204': {
            description: 'No content',
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        'x-required-permission': 'CONTENT_DELETE',
      },
    },
    '/api/v1/admin/content/{id}/publish': {
      post: {
        summary: 'Publish content',
        operationId: 'post_admin_content_id_publish',
        tags: ['content'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ContentResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'Idempotent transition. Archived content cannot be republished.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        'x-required-permission': 'CONTENT_PUBLISH',
      },
    },
    '/api/v1/admin/content/{id}/archive': {
      post: {
        summary: 'Archive content',
        operationId: 'post_admin_content_id_archive',
        tags: ['content'],
        security: [
          {
            sessionCookie: [],
            csrfHeader: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ContentResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'Idempotent transition. Archived content cannot be republished.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        'x-required-permission': 'CONTENT_PUBLISH',
      },
    },
    '/api/v1/admin/activity': {
      get: {
        summary: 'Read recent activity from DynamoDB',
        operationId: 'get_admin_activity',
        tags: ['activity'],
        security: [
          {
            sessionCookie: [],
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ActivityPage',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        description:
          'Cursor is scoped to the query. Global GSI reads are eventually consistent.',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
          {
            name: 'entityType',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['PRODUCT', 'CONTENT'],
            },
            description: 'Requires entityId as well.',
          },
          {
            name: 'entityId',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Requires entityType as well.',
          },
          {
            name: 'cursor',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              maxLength: 2048,
            },
          },
        ],
        'x-required-permission': 'ACTIVITY_READ',
      },
    },
    '/api/v1/health': {
      get: {
        summary: 'Process liveness',
        operationId: 'get_health',
        tags: ['health'],
        security: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Health',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/health/live': {
      get: {
        summary: 'Process liveness',
        operationId: 'get_health_live',
        tags: ['health'],
        security: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Health',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/health/ready': {
      get: {
        summary: 'PostgreSQL readiness',
        operationId: 'get_health_ready',
        tags: ['health'],
        security: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Readiness',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Authentication required or invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Permission, origin or CSRF rejected',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflicting operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '413': {
            description: 'Body too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported content type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '503': {
            description: 'Dependency or authentication capacity unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'cloudops_session',
        description:
          'Opaque HttpOnly session cookie; production cookie is __Host-cloudops_session. Secure in production, SameSite=Lax, absolute lifetime configured up to 24 hours.',
      },
      csrfHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-CSRF-Token',
        description:
          'Session-bound token obtained from login/me; required with session cookie for mutations.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        additionalProperties: false,
        properties: {
          error: {
            type: 'object',
            additionalProperties: false,
            properties: {
              code: {
                type: 'string',
              },
              message: {
                type: 'string',
              },
              requestId: {
                type: 'string',
              },
            },
            required: ['code', 'message', 'requestId'],
          },
        },
        required: ['error'],
      },
      User: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
          email: {
            type: 'string',
            format: 'email',
            maxLength: 254,
          },
          role: {
            type: 'string',
            enum: ['ADMIN', 'EDITOR', 'VIEWER'],
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'DISABLED'],
          },
        },
        required: ['id', 'createdAt', 'updatedAt', 'email', 'role', 'status'],
      },
      Category: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
          name: {
            type: 'string',
          },
          slug: {
            type: 'string',
          },
        },
        required: ['id', 'createdAt', 'updatedAt', 'name', 'slug'],
      },
      ContentInput: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
          },
          slug: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
          },
          summary: {
            type: ['string', 'null'],
            maxLength: 5000,
          },
          body: {
            type: 'string',
            minLength: 1,
            maxLength: 50000,
          },
        },
        required: ['title', 'slug', 'body'],
      },
      ContentUpdate: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
          },
          slug: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
          },
          summary: {
            type: ['string', 'null'],
            maxLength: 5000,
          },
          body: {
            type: 'string',
            minLength: 1,
            maxLength: 50000,
          },
        },
        minProperties: 1,
      },
      Content: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
          },
          slug: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
          },
          summary: {
            type: ['string', 'null'],
            maxLength: 5000,
          },
          body: {
            type: 'string',
            minLength: 1,
            maxLength: 50000,
          },
          status: {
            type: 'string',
            enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
          },
          publishedAt: {
            type: ['string', 'null'],
            format: 'date-time',
          },
        },
        required: [
          'id',
          'createdAt',
          'updatedAt',
          'title',
          'slug',
          'summary',
          'body',
          'status',
          'publishedAt',
        ],
      },
      ProductInput: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
          },
          slug: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
          },
          description: {
            type: ['string', 'null'],
            maxLength: 5000,
          },
          price: {
            type: 'string',
            pattern: '^(0|[1-9]\\d{0,9})(\\.\\d{1,2})?$',
          },
          status: {
            type: 'string',
            enum: ['DRAFT', 'ACTIVE', 'INACTIVE'],
          },
          categoryId: {
            type: 'string',
            format: 'uuid',
          },
        },
        required: ['name', 'slug', 'price', 'status', 'categoryId'],
      },
      ProductUpdate: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
          },
          slug: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
          },
          description: {
            type: ['string', 'null'],
            maxLength: 5000,
          },
          price: {
            type: 'string',
            pattern: '^(0|[1-9]\\d{0,9})(\\.\\d{1,2})?$',
          },
          status: {
            type: 'string',
            enum: ['DRAFT', 'ACTIVE', 'INACTIVE'],
          },
          categoryId: {
            type: 'string',
            format: 'uuid',
          },
        },
        minProperties: 1,
      },
      Product: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
          },
          slug: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
          },
          description: {
            type: ['string', 'null'],
            maxLength: 5000,
          },
          price: {
            type: 'string',
            pattern: '^(0|[1-9]\\d{0,9})(\\.\\d{1,2})?$',
          },
          status: {
            type: 'string',
            enum: ['DRAFT', 'ACTIVE', 'INACTIVE'],
          },
          categoryId: {
            type: 'string',
            format: 'uuid',
          },
          category: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
              name: {
                type: 'string',
              },
              slug: {
                type: 'string',
              },
            },
            required: ['id', 'name', 'slug'],
          },
        },
        required: [
          'id',
          'createdAt',
          'updatedAt',
          'name',
          'slug',
          'description',
          'price',
          'status',
          'categoryId',
          'category',
        ],
      },
      Login: {
        type: 'object',
        additionalProperties: false,
        properties: {
          email: {
            type: 'string',
            format: 'email',
            maxLength: 254,
          },
          password: {
            type: 'string',
            minLength: 1,
            maxLength: 128,
            writeOnly: true,
          },
        },
        required: ['email', 'password'],
      },
      PasswordChange: {
        type: 'object',
        additionalProperties: false,
        properties: {
          currentPassword: {
            type: 'string',
            minLength: 1,
            maxLength: 128,
            writeOnly: true,
          },
          newPassword: {
            type: 'string',
            minLength: 12,
            maxLength: 128,
            writeOnly: true,
            description: 'At most 256 UTF-8 bytes.',
          },
        },
        required: ['currentPassword', 'newPassword'],
      },
      CreateUser: {
        type: 'object',
        additionalProperties: false,
        properties: {
          email: {
            type: 'string',
            format: 'email',
            maxLength: 254,
          },
          password: {
            type: 'string',
            minLength: 12,
            maxLength: 128,
            writeOnly: true,
            description: 'At most 256 UTF-8 bytes.',
          },
          role: {
            type: 'string',
            enum: ['ADMIN', 'EDITOR', 'VIEWER'],
          },
        },
        required: ['email', 'password', 'role'],
      },
      RoleInput: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: {
            type: 'string',
            enum: ['ADMIN', 'EDITOR', 'VIEWER'],
          },
        },
        required: ['role'],
      },
      StatusInput: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: {
            type: 'string',
            enum: ['ACTIVE', 'DISABLED'],
          },
        },
        required: ['status'],
      },
      AuthSession: {
        type: 'object',
        additionalProperties: false,
        properties: {
          user: {
            $ref: '#/components/schemas/User',
          },
          permissions: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
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
              ],
            },
          },
          csrfToken: {
            type: 'string',
            minLength: 43,
            maxLength: 43,
            description:
              'Send as X-CSRF-Token on cookie-authenticated mutations.',
          },
        },
        required: ['user', 'permissions', 'csrfToken'],
      },
      Pagination: {
        type: 'object',
        additionalProperties: false,
        properties: {
          page: {
            type: 'integer',
            minimum: 0,
          },
          limit: {
            type: 'integer',
            minimum: 0,
          },
          total: {
            type: 'integer',
            minimum: 0,
          },
          totalPages: {
            type: 'integer',
            minimum: 0,
          },
        },
        required: ['page', 'limit', 'total', 'totalPages'],
      },
      ActivityEvent: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          entityId: {
            type: 'string',
            format: 'uuid',
          },
          entityType: {
            type: 'string',
            enum: ['PRODUCT', 'CONTENT'],
          },
          eventType: {
            type: 'string',
            enum: [
              'PRODUCT_CREATED',
              'PRODUCT_UPDATED',
              'PRODUCT_DELETED',
              'CONTENT_CREATED',
              'CONTENT_UPDATED',
              'CONTENT_PUBLISHED',
              'CONTENT_ARCHIVED',
              'CONTENT_DELETED',
            ],
          },
          occurredAt: {
            type: 'string',
            format: 'date-time',
          },
          actor: {
            oneOf: [
              {
                type: 'object',
                additionalProperties: false,
                properties: {
                  kind: {
                    type: 'string',
                    enum: ['SYSTEM', 'ADMIN_PORTAL'],
                  },
                },
                required: ['kind'],
              },
              {
                type: 'object',
                additionalProperties: false,
                properties: {
                  kind: {
                    const: 'USER',
                  },
                  id: {
                    type: 'string',
                  },
                },
                required: ['kind', 'id'],
              },
            ],
          },
          data: {
            type: 'object',
            additionalProperties: false,
            properties: {
              slug: {
                type: 'string',
              },
              changedFields: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              status: {
                type: 'string',
              },
            },
          },
        },
        required: [
          'id',
          'entityId',
          'entityType',
          'eventType',
          'occurredAt',
          'actor',
          'data',
        ],
      },
      UserResponse: {
        type: 'object',
        additionalProperties: false,
        properties: {
          data: {
            $ref: '#/components/schemas/User',
          },
        },
        required: ['data'],
      },
      UserPage: {
        type: 'object',
        additionalProperties: false,
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/User',
            },
          },
          pagination: {
            $ref: '#/components/schemas/Pagination',
          },
        },
        required: ['data', 'pagination'],
      },
      ProductResponse: {
        type: 'object',
        additionalProperties: false,
        properties: {
          data: {
            $ref: '#/components/schemas/Product',
          },
        },
        required: ['data'],
      },
      ProductPage: {
        type: 'object',
        additionalProperties: false,
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Product',
            },
          },
          pagination: {
            $ref: '#/components/schemas/Pagination',
          },
        },
        required: ['data', 'pagination'],
      },
      ContentResponse: {
        type: 'object',
        additionalProperties: false,
        properties: {
          data: {
            $ref: '#/components/schemas/Content',
          },
        },
        required: ['data'],
      },
      ContentPage: {
        type: 'object',
        additionalProperties: false,
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Content',
            },
          },
          pagination: {
            $ref: '#/components/schemas/Pagination',
          },
        },
        required: ['data', 'pagination'],
      },
      ActivityPage: {
        type: 'object',
        additionalProperties: false,
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ActivityEvent',
            },
          },
          nextCursor: {
            type: ['string', 'null'],
          },
        },
        required: ['data', 'nextCursor'],
      },
      Categories: {
        type: 'object',
        additionalProperties: false,
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Category',
            },
          },
        },
        required: ['data'],
      },
      Health: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: {
            const: 'ok',
          },
          service: {
            const: 'cloudops-content-api',
          },
        },
        required: ['status', 'service'],
      },
      Readiness: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: {
            const: 'ready',
          },
          service: {
            const: 'cloudops-content-api',
          },
        },
        required: ['status', 'service'],
      },
    },
  },
} as const;
