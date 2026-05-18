import axios from 'axios';
import {
  fetchPlayersByCompetition,
  fetchTeamsByCompetition,
  fetchTeamById,
  leagueNameByCode,
  resetClientForTests,
} from '../football-data.client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockGet = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  resetClientForTests();
  process.env.FOOTBALL_DATA_TOKEN = 'test-token';
  mockedAxios.create.mockReturnValue({ get: mockGet } as unknown as ReturnType<typeof axios.create>);
});

describe('football-data.client', () => {
  it('leagueNameByCode maps known codes', () => {
    expect(leagueNameByCode('PL')).toBe('Premier League');
    expect(leagueNameByCode('SA')).toBe('Serie A');
  });

  it('fetchTeamsByCompetition returns data on success and uses bearer token', async () => {
    mockGet.mockResolvedValueOnce({ data: { competition: {}, teams: [] } });

    const res = await fetchTeamsByCompetition('PL');

    expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({
      headers: { 'X-Auth-Token': 'test-token' },
    }));
    expect(mockGet).toHaveBeenCalledWith('/competitions/PL/teams');
    expect(res).toEqual({ competition: {}, teams: [] });
  });

  it('fetchTeamsByCompetition returns null on error (does not throw)', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    const res = await fetchTeamsByCompetition('PL');
    expect(res).toBeNull();
  });

  it('fetchTeamById returns null on error', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    const res = await fetchTeamById(123);
    expect(res).toBeNull();
  });

  it('fetchPlayersByCompetition flattens squads with externalId and league/team', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        competition: { id: 1, name: 'Premier League', code: 'PL', area: { id: 0, name: '', code: '' } },
        teams: [
          {
            id: 10,
            name: 'Arsenal',
            area: { id: 0, name: '', code: '' },
            squad: [{ id: 100, name: 'Saka', position: 'Offence' }],
          },
        ],
      },
    });

    const players = await fetchPlayersByCompetition('PL');

    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      externalId: 'fd:100',
      name: 'Saka',
      league: 'Premier League',
      team: 'Arsenal',
      position: 'Offence',
      goals: 0,
      yellowCards: 0,
    });
  });

  it('fetchPlayersByCompetition fetches team detail when squad is missing', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: {
          competition: { id: 1, name: 'PL', code: 'PL', area: { id: 0, name: '', code: '' } },
          teams: [{ id: 10, name: 'Arsenal', area: { id: 0, name: '', code: '' } }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 10,
          name: 'Arsenal',
          area: { id: 0, name: '', code: '' },
          squad: [{ id: 200, name: 'Odegaard', position: 'Midfield' }],
        },
      });

    const players = await fetchPlayersByCompetition('PL');

    expect(mockGet).toHaveBeenNthCalledWith(1, '/competitions/PL/teams');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/teams/10');
    expect(players).toHaveLength(1);
    expect(players[0]?.externalId).toBe('fd:200');
  });

  it('fetchPlayersByCompetition returns [] when competition fetch fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    const players = await fetchPlayersByCompetition('PL');
    expect(players).toEqual([]);
  });
});
