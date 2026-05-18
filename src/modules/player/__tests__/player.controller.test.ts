import { Request, Response } from 'express';
import { getPlayersHandler, getPlayerByIdHandler, syncPlayersHandler } from '../player.controller';
import * as service from '../player.service';

jest.mock('../player.service');

const mkRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

beforeEach(() => jest.clearAllMocks());

describe('player.controller', () => {
  it('getPlayersHandler forwards filters from query', async () => {
    (service.listPlayers as jest.Mock).mockResolvedValue([]);
    const req = { query: { league: 'PL', team: 'Arsenal' } } as unknown as Request;
    const res = mkRes();
    await getPlayersHandler(req, res, jest.fn());
    expect(service.listPlayers).toHaveBeenCalledWith({ league: 'PL', team: 'Arsenal', position: undefined });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getPlayerByIdHandler returns 404 when not found', async () => {
    (service.getPlayerById as jest.Mock).mockResolvedValue(null);
    const req = { params: { id: 'x' } } as unknown as Request;
    const res = mkRes();
    await getPlayerByIdHandler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('getPlayerByIdHandler returns the player when found', async () => {
    (service.getPlayerById as jest.Mock).mockResolvedValue({ _id: 'x', name: 'P' });
    const req = { params: { id: 'x' } } as unknown as Request;
    const res = mkRes();
    await getPlayerByIdHandler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ _id: 'x', name: 'P' });
  });

  it('syncPlayersHandler requires league and team', async () => {
    const req = { body: { league: 'PL' } } as Request;
    const res = mkRes();
    await syncPlayersHandler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('syncPlayersHandler returns count on success', async () => {
    (service.syncPlayersFromScrapper as jest.Mock).mockResolvedValue(7);
    const req = { body: { league: 'PL', team: 'Arsenal' } } as Request;
    const res = mkRes();
    await syncPlayersHandler(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({ upserted: 7 });
  });
});
