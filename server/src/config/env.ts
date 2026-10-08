import type { PoolConfig } from 'pg';
import { isIP } from 'node:net';
import { readDatabaseConfig } from './database.js';

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  clientOrigin: string;
  databaseUrl?: string;
  database?: PoolConfig;
  trustedProxyCidrs?: string[];
  cloudfrontProxyCidrs?: string[];
}

export function readConfig(env: NodeJS.ProcessEnv): Config {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  const port = Number(env.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be an integer between 1 and 65535');
  const clientOrigin = env.CLIENT_ORIGIN;
  if (!clientOrigin) throw new Error('CLIENT_ORIGIN is required');
  const origin = new URL(clientOrigin);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.origin !== clientOrigin
  ) {
    throw new Error(
      'CLIENT_ORIGIN must be an HTTP origin without a trailing slash or path',
    );
  }
  const database = readDatabaseConfig(env);
  const trustedProxyCidrs = env.TRUSTED_PROXY_CIDRS?.split(',');
  if (trustedProxyCidrs?.some((cidr) => !/^10\.42\.(0|1)\.0\/24$/.test(cidr)))
    throw new Error(
      'TRUSTED_PROXY_CIDRS must contain only the ALB subnet CIDRs',
    );
  const cloudfrontProxyCidrs = env.CLOUDFRONT_PROXY_CIDRS?.split(',');
  if (Boolean(trustedProxyCidrs) !== Boolean(cloudfrontProxyCidrs))
    throw new Error(
      'ALB and CloudFront proxy CIDRs must be configured together',
    );
  if (
    cloudfrontProxyCidrs?.some((cidr) => {
      const [address, prefix, extra] = cidr.split('/');
      return (
        extra !== undefined ||
        !address ||
        isIP(address) !== 4 ||
        !prefix ||
        !/^\d+$/.test(prefix) ||
        Number(prefix) < 8 ||
        Number(prefix) > 32
      );
    })
  )
    throw new Error(
      'CLOUDFRONT_PROXY_CIDRS must contain explicit IPv4 CIDRs from the managed origin prefix list',
    );
  const databaseUrl = env.DATABASE_URL;
  return {
    nodeEnv: nodeEnv as Config['nodeEnv'],
    port,
    clientOrigin,
    ...(databaseUrl ? { databaseUrl } : {}),
    ...(database ? { database } : {}),
    ...(trustedProxyCidrs ? { trustedProxyCidrs } : {}),
    ...(cloudfrontProxyCidrs ? { cloudfrontProxyCidrs } : {}),
  };
}
