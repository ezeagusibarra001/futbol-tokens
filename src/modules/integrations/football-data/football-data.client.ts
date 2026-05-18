import axios, { AxiosInstance } from 'axios';
import { IPlayer } from '../../player/player.model';
import {
  CompetitionCode,
  COMPETITION_CODES,
  FDCompetitionTeamsResponse,
  FDTeamResponse,
} from './dto/football-data.dto';
import { logger } from '../../../config/logger';

const BASE_URL = 'https://api.football-data.org/v4';

let cached: AxiosInstance | null = null;

const getClient = (): AxiosInstance => {
  if (cached) return cached;
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error('FOOTBALL_DATA_TOKEN is not defined');
  cached = axios.create({
    baseURL: BASE_URL,
    headers: { 'X-Auth-Token': token },
    timeout: 15000,
  });
  return cached;
};

export const resetClientForTests = (): void => {
  cached = null;
};

export const leagueNameByCode = (code: CompetitionCode): string => {
  const entry = Object.entries(COMPETITION_CODES).find(([, c]) => c === code);
  return entry ? entry[0] : code;
};

export const fetchTeamsByCompetition = async (
  code: CompetitionCode
): Promise<FDCompetitionTeamsResponse | null> => {
  try {
    const res = await getClient().get<FDCompetitionTeamsResponse>(`/competitions/${code}/teams`);
    return res.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    logger.warn(`[football-data] fetchTeamsByCompetition(${code}) failed: ${msg}`);
    return null;
  }
};

export const fetchTeamById = async (teamId: number): Promise<FDTeamResponse | null> => {
  try {
    const res = await getClient().get<FDTeamResponse>(`/teams/${teamId}`);
    return res.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    logger.warn(`[football-data] fetchTeamById(${teamId}) failed: ${msg}`);
    return null;
  }
};

export const fetchPlayersByCompetition = async (code: CompetitionCode): Promise<IPlayer[]> => {
  const league = leagueNameByCode(code);
  const teamsResp = await fetchTeamsByCompetition(code);
  if (!teamsResp) return [];

  const players: IPlayer[] = [];
  for (const team of teamsResp.teams) {
    let squad = team.squad;
    if (!squad || squad.length === 0) {
      const detail = await fetchTeamById(team.id);
      squad = detail?.squad ?? [];
    }
    for (const p of squad) {
      players.push({
        externalId: `fd:${p.id}`,
        name: p.name,
        position: p.position ?? '',
        league,
        team: team.name,
        goals: 0,
        assists: 0,
        shots: 0,
        rating: 0,
        keyPasses: 0,
        dribbles: 0,
        tackles: 0,
        minutesPlayed: 0,
        yellowCards: 0,
        redCards: 0,
      });
    }
  }
  return players;
};
