import type { PrismaClient } from '@paperscraper/db';
import type {
  PipelineAddCardInput,
  PipelineBoard,
  PipelineCreateInput,
  PipelineDeleteOutput,
  PipelineMoveCardInput,
  PipelineRemoveCardInput,
  PipelineSummary,
  PipelineUpdateInput,
} from '@paperscraper/shared';
import {
  assertStage,
  clampPosition,
  createPipelineWithStages,
  ensureBoardPipeline,
  getBoardByPipelineId,
  toPipelineSummary,
} from './pipeline-provider-shared';

export interface PipelineProviderDeps {
  listPipelines: () => Promise<PipelineSummary[]>;
  createPipeline: (input: PipelineCreateInput) => Promise<PipelineSummary>;
  updatePipeline: (input: PipelineUpdateInput) => Promise<PipelineSummary | null>;
  deletePipeline: (pipelineId: string) => Promise<PipelineDeleteOutput | null>;
  getBoard: (pipelineId?: string) => Promise<PipelineBoard>;
  addCard: (input: PipelineAddCardInput) => Promise<PipelineBoard>;
  moveCard: (input: PipelineMoveCardInput) => Promise<PipelineBoard>;
  removeCard: (input: PipelineRemoveCardInput) => Promise<PipelineBoard>;
}

export function createPipelineProvider(prisma: PrismaClient): PipelineProviderDeps {
  return {
    listPipelines: async () => {
      const rows = await prisma.pipeline.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return rows.map(toPipelineSummary);
    },

    createPipeline: async (input) => {
      const created = await createPipelineWithStages(prisma, input);
      return toPipelineSummary(created);
    },

    updatePipeline: async (input) => {
      const existing = await prisma.pipeline.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (!existing) {
        return null;
      }
      await prisma.$transaction(async (tx) => {
        if (input.name !== undefined || input.description !== undefined) {
          await tx.pipeline.update({
            where: { id: input.id },
            data: { name: input.name, description: input.description },
            select: { id: true },
          });
        }
        if (input.stages && input.stages.length > 0) {
          for (const patch of input.stages) {
            const updated = await tx.pipelineStage.updateMany({
              where: { id: patch.id, pipelineId: input.id },
              data: { name: patch.name },
            });
            if (updated.count === 0) {
              throw new Error('Stage not found for update.');
            }
          }
        }
      });
      const row = await prisma.pipeline.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return row ? toPipelineSummary(row) : null;
    },

    deletePipeline: async (pipelineId) => {
      const existing = await prisma.pipeline.findUnique({
        where: { id: pipelineId },
        select: { id: true },
      });
      if (!existing) {
        return null;
      }
      await prisma.pipeline.delete({ where: { id: pipelineId }, select: { id: true } });
      return { id: pipelineId, status: 'deleted' };
    },

    getBoard: async (pipelineId) => {
      const selectedPipelineId = await ensureBoardPipeline(prisma, pipelineId);
      const board = await getBoardByPipelineId(prisma, selectedPipelineId);
      if (!board) {
        throw new Error('Pipeline board not found.');
      }
      return board;
    },

    addCard: async (input) => {
      await prisma.$transaction(async (tx) => {
        await assertStage(tx, input.pipelineId, input.stageId);
        const existing = await tx.objectPipelineCard.findUnique({
          where: {
            pipelineId_objectId: {
              pipelineId: input.pipelineId,
              objectId: input.objectId,
            },
          },
          select: { id: true },
        });
        if (existing) {
          return;
        }
        const current = await tx.objectPipelineCard.findMany({
          where: { pipelineId: input.pipelineId, stageId: input.stageId },
          orderBy: { position: 'asc' },
          select: { id: true },
        });
        const position = clampPosition(input.position, current.length);
        await tx.objectPipelineCard.updateMany({
          where: {
            pipelineId: input.pipelineId,
            stageId: input.stageId,
            position: { gte: position },
          },
          data: { position: { increment: 1 } },
        });
        await tx.objectPipelineCard.create({
          data: {
            pipelineId: input.pipelineId,
            stageId: input.stageId,
            objectId: input.objectId,
            position,
          },
          select: { id: true },
        });
      });
      const board = await getBoardByPipelineId(prisma, input.pipelineId);
      if (!board) {
        throw new Error('Pipeline board not found after add card.');
      }
      return board;
    },

    moveCard: async (input) => {
      await prisma.$transaction(async (tx) => {
        await assertStage(tx, input.pipelineId, input.toStageId);
        const card = await tx.objectPipelineCard.findFirst({
          where: { id: input.cardId, pipelineId: input.pipelineId },
          select: { id: true, stageId: true },
        });
        if (!card) {
          throw new Error('Card not found.');
        }
        const sourceCards = await tx.objectPipelineCard.findMany({
          where: { pipelineId: input.pipelineId, stageId: card.stageId },
          orderBy: { position: 'asc' },
          select: { id: true },
        });
        const targetCards =
          card.stageId === input.toStageId
            ? sourceCards
            : await tx.objectPipelineCard.findMany({
                where: { pipelineId: input.pipelineId, stageId: input.toStageId },
                orderBy: { position: 'asc' },
                select: { id: true },
              });

        if (card.stageId === input.toStageId) {
          const reordered = sourceCards.map((item) => item.id).filter((id) => id !== card.id);
          reordered.splice(clampPosition(input.toPosition, reordered.length), 0, card.id);
          for (let index = 0; index < reordered.length; index += 1) {
            await tx.objectPipelineCard.update({
              where: { id: reordered[index] },
              data: { position: index },
              select: { id: true },
            });
          }
          return;
        }

        const sourceIds = sourceCards.map((item) => item.id).filter((id) => id !== card.id);
        const targetIds = targetCards.map((item) => item.id);
        targetIds.splice(clampPosition(input.toPosition, targetIds.length), 0, card.id);
        for (let index = 0; index < sourceIds.length; index += 1) {
          await tx.objectPipelineCard.update({
            where: { id: sourceIds[index] },
            data: { position: index },
            select: { id: true },
          });
        }
        for (let index = 0; index < targetIds.length; index += 1) {
          await tx.objectPipelineCard.update({
            where: { id: targetIds[index] },
            data: { stageId: input.toStageId, position: index },
            select: { id: true },
          });
        }
      });

      const board = await getBoardByPipelineId(prisma, input.pipelineId);
      if (!board) {
        throw new Error('Pipeline board not found after move card.');
      }
      return board;
    },

    removeCard: async (input) => {
      await prisma.$transaction(async (tx) => {
        const card = await tx.objectPipelineCard.findFirst({
          where: { id: input.cardId, pipelineId: input.pipelineId },
          select: { id: true, stageId: true, position: true },
        });
        if (!card) {
          return;
        }
        await tx.objectPipelineCard.delete({ where: { id: card.id }, select: { id: true } });
        await tx.objectPipelineCard.updateMany({
          where: {
            pipelineId: input.pipelineId,
            stageId: card.stageId,
            position: { gt: card.position },
          },
          data: { position: { decrement: 1 } },
        });
      });

      const board = await getBoardByPipelineId(prisma, input.pipelineId);
      if (!board) {
        throw new Error('Pipeline board not found after remove card.');
      }
      return board;
    },
  };
}
