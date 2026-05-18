import cron, { ScheduledTask } from 'node-cron';
import { recalculateAll } from '../modules/quote/quote.service';
import { syncCatalogFromFootballData } from '../modules/player/player.service';
import { COMPETITION_CODES, CompetitionCode } from '../modules/integrations/football-data/dto/football-data.dto';

const DEFAULT_RECALC_CRON = '0 3 * * 1';
const DEFAULT_SYNC_CRON = '0 4 * * 1';

const tasks: ScheduledTask[] = [];

export const runRecalcJob = async (): Promise<void> => {
  try {
    const res = await recalculateAll();
    console.info(`[scheduler] recalc done: ${res.quotesCreated} quotes via ${res.strategy} v${res.version}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error(`[scheduler] recalc failed: ${msg}`);
  }
};

export const runSyncJob = async (): Promise<void> => {
  const codes = Object.values(COMPETITION_CODES) as CompetitionCode[];
  for (const code of codes) {
    try {
      const upserted = await syncCatalogFromFootballData(code);
      console.info(`[scheduler] sync ${code}: ${upserted} players upserted`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      console.error(`[scheduler] sync ${code} failed: ${msg}`);
    }
  }
};

export const startScheduler = (): void => {
  if (process.env.SCHEDULER_ENABLED !== 'true') return;

  const recalcCron = process.env.SCHEDULER_CRON_RECALC ?? DEFAULT_RECALC_CRON;
  const syncCron = process.env.SCHEDULER_CRON_SYNC ?? DEFAULT_SYNC_CRON;

  if (!cron.validate(recalcCron)) {
    console.warn(`[scheduler] invalid recalc cron "${recalcCron}", using default`);
  }
  if (!cron.validate(syncCron)) {
    console.warn(`[scheduler] invalid sync cron "${syncCron}", using default`);
  }

  tasks.push(cron.schedule(cron.validate(recalcCron) ? recalcCron : DEFAULT_RECALC_CRON, runRecalcJob));
  tasks.push(cron.schedule(cron.validate(syncCron) ? syncCron : DEFAULT_SYNC_CRON, runSyncJob));

  console.info('[scheduler] started');
};

export const stopScheduler = (): void => {
  for (const t of tasks) t.stop();
  tasks.length = 0;
};
