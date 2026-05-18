import cron from 'node-cron';
import { runRecalcJob, runSyncJob, startScheduler, stopScheduler } from '../scheduler';
import * as quoteService from '../../modules/quote/quote.service';
import * as playerService from '../../modules/player/player.service';

jest.mock('node-cron');
jest.mock('../../modules/quote/quote.service');
jest.mock('../../modules/player/player.service');

const mockedCron = cron as jest.Mocked<typeof cron>;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.SCHEDULER_ENABLED;
  mockedCron.validate.mockReturnValue(true);
  mockedCron.schedule.mockReturnValue({ stop: jest.fn() } as unknown as ReturnType<typeof cron.schedule>);
});

describe('scheduler', () => {
  it('startScheduler does nothing when SCHEDULER_ENABLED is not "true"', () => {
    startScheduler();
    expect(mockedCron.schedule).not.toHaveBeenCalled();
  });

  it('startScheduler schedules recalc and sync jobs when enabled', () => {
    process.env.SCHEDULER_ENABLED = 'true';
    process.env.SCHEDULER_CRON_RECALC = '0 5 * * 1';
    process.env.SCHEDULER_CRON_SYNC = '0 6 * * 1';

    startScheduler();

    expect(mockedCron.schedule).toHaveBeenCalledTimes(2);
    expect(mockedCron.schedule).toHaveBeenNthCalledWith(1, '0 5 * * 1', expect.any(Function));
    expect(mockedCron.schedule).toHaveBeenNthCalledWith(2, '0 6 * * 1', expect.any(Function));

    stopScheduler();
  });

  it('falls back to defaults when cron expressions are invalid', () => {
    process.env.SCHEDULER_ENABLED = 'true';
    process.env.SCHEDULER_CRON_RECALC = 'not-a-cron';
    delete process.env.SCHEDULER_CRON_SYNC;
    mockedCron.validate.mockImplementation((v: string) => v !== 'not-a-cron');

    startScheduler();

    expect(mockedCron.schedule).toHaveBeenNthCalledWith(1, '0 3 * * 1', expect.any(Function));
    stopScheduler();
  });

  it('runRecalcJob delegates to recalculateAll and swallows errors', async () => {
    (quoteService.recalculateAll as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(runRecalcJob()).resolves.toBeUndefined();
  });

  it('runSyncJob iterates the 5 competition codes', async () => {
    (playerService.syncCatalogFromFootballData as jest.Mock).mockResolvedValue(0);
    await runSyncJob();
    expect(playerService.syncCatalogFromFootballData).toHaveBeenCalledTimes(5);
  });
});
