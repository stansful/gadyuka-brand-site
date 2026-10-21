import { deepStrictEqual, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { Prisma } from '~prisma-generated/prisma/client';

import { PrismaErrorRenderer } from './prisma-error.renderer';

describe('PrismaErrorRenderer (known database errors → message keys)', () => {
  const renderer = new PrismaErrorRenderer();
  const errorOf = (code: string) =>
    new Prisma.PrismaClientKnownRequestError(`${code} failed`, { code, clientVersion: '7' });

  it('maps unique, foreign key and missing-row errors', () => {
    deepStrictEqual(renderer.render(errorOf('P2002')).body, {
      statusCode: 409,
      error: 'conflict',
      key: 'admin.errors.duplicate',
    });
    deepStrictEqual(renderer.render(errorOf('P2003')).body, {
      statusCode: 409,
      error: 'conflict',
      key: 'admin.errors.related',
    });
    deepStrictEqual(renderer.render(errorOf('P2025')), {
      status: 404,
      body: { statusCode: 404, error: 'notFound', key: 'admin.errors.notFound' },
    });
  });

  it('leaves other errors to the unexpected-error renderer (500)', () => {
    strictEqual(renderer.canRender(errorOf('P2002')), true);
    strictEqual(renderer.canRender(errorOf('P1001')), false);
    strictEqual(renderer.canRender(new Error('P2002')), false);
  });
});
