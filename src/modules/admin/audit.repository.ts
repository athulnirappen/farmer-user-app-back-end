import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';

export const recordAdminAction = (data: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Prisma.InputJsonValue;
}) => {
  return prisma.adminAuditLog.create({ data });
};

type AuditFilters = { actorId?: string; targetType?: string; targetId?: string };

const auditWhere = (data: AuditFilters): Prisma.AdminAuditLogWhereInput => ({
  ...(data.actorId && { actorId: data.actorId }),
  ...(data.targetType && { targetType: data.targetType }),
  ...(data.targetId && { targetId: data.targetId }),
});

export const findAuditEntries = (data: AuditFilters & { skip: number; take: number }) => {
  return prisma.adminAuditLog.findMany({
    where: auditWhere(data),
    orderBy: { createdAt: 'desc' },
    skip: data.skip,
    take: data.take,
    include: { actor: { select: { id: true, name: true, email: true } } },
  });
};

export const countAuditEntries = (data: AuditFilters) =>
  prisma.adminAuditLog.count({ where: auditWhere(data) });
