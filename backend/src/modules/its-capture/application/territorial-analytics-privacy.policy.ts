import { Injectable } from '@nestjs/common';
import type {
  TerritorialAnalyticsPublicRow,
  TerritorialAnalyticsRow,
} from '../domain/territorial-analytics';

export interface ProtectedTerritorialAnalyticsRows {
  smallCountThreshold: number;
  suppressedValue: null;
  rows: readonly TerritorialAnalyticsPublicRow[];
}

/**
 * ITS-2 aggregates expose exact counts to authorized territorial users.
 * Individual ITS-1 access remains protected by its own authorization policy.
 */
@Injectable()
export class TerritorialAnalyticsPrivacyPolicy {
  get smallCountThreshold(): number {
    return 0;
  }

  protect(rows: readonly TerritorialAnalyticsRow[]): ProtectedTerritorialAnalyticsRows {
    return {
      smallCountThreshold: 0,
      suppressedValue: null,
      rows: rows.map((row) => {
        const publicRow = { ...row };
        delete publicRow.parentId;
        return {
          ...publicRow,
          attentions: row.attentions,
          newCases: row.newCases,
          controls: row.controls,
          alerts: row.alerts,
          suppressedMetrics: [],
          complementarySuppressedMetrics: [],
        };
      }),
    };
  }
}
