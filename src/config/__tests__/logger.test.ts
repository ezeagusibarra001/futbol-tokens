import { logger } from '../logger';

describe('logger', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    delete process.env.LOG_LEVEL;
  });

  it('respects LOG_LEVEL: debug is skipped at info level', () => {
    process.env.LOG_LEVEL = 'info';
    logger.debug('skip me');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('emits info messages via console.log', () => {
    logger.info('hello');
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls[0][0]).toContain('INFO');
    expect(logSpy.mock.calls[0][0]).toContain('hello');
  });

  it('attaches meta as JSON', () => {
    logger.warn('uh oh', { code: 42 });
    expect(warnSpy.mock.calls[0][0]).toContain('"code":42');
  });

  it('error level uses console.error', () => {
    logger.error('boom');
    expect(errorSpy).toHaveBeenCalled();
  });
});
