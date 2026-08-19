import { Injectable } from '@nestjs/common';
import { ItsAttentionRepository } from './ports/its-attention.repository';
import {
  InvalidAttentionError,
  type AttentionCursor,
  type AttentionPage,
} from '../domain/its-attention';

@Injectable()
export class ListAttentionsUseCase {
  constructor(private readonly repository: ItsAttentionRepository) {}

  async execute(input: {
    facilityId: string;
    year: number;
    month: number;
    limit: number;
    cursor?: string;
  }): Promise<AttentionPage> {
    const cursor = input.cursor ? this.decodeCursor(input.cursor) : undefined;
    const rows = await this.repository.list({ ...input, limit: input.limit + 1, cursor });
    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    const last = items.at(-1);
    return {
      items,
      ...(hasMore && last
        ? { nextCursor: this.encodeCursor({ attentionDate: last.attentionDate, id: last.id }) }
        : {}),
    };
  }

  private encodeCursor(cursor: AttentionCursor): string {
    return Buffer.from(
      JSON.stringify({ attentionDate: cursor.attentionDate.toISOString(), id: cursor.id }),
    ).toString('base64url');
  }

  private decodeCursor(value: string): AttentionCursor {
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
        attentionDate?: unknown;
        id?: unknown;
      };
      const attentionDate = new Date(String(parsed.attentionDate));
      if (
        typeof parsed.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(parsed.id) ||
        Number.isNaN(attentionDate.getTime())
      )
        throw new Error('Invalid cursor');
      return { attentionDate, id: parsed.id };
    } catch {
      throw new InvalidAttentionError('El cursor de paginación no es válido.');
    }
  }
}
