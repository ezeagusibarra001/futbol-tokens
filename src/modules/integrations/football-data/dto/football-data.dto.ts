export type FDArea = { id: number; name: string; code: string };

export type FDCompetition = {
  id: number;
  name: string;
  code: string;
  area: FDArea;
};

export type FDPlayer = {
  id: number;
  name: string;
  position?: string;
  nationality?: string;
  dateOfBirth?: string;
};

export type FDTeam = {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  area: FDArea;
  squad?: FDPlayer[];
};

export type FDCompetitionTeamsResponse = {
  competition: FDCompetition;
  teams: FDTeam[];
};

export type FDTeamResponse = FDTeam;

export const COMPETITION_CODES = {
  'Premier League': 'PL',
  'Bundesliga': 'BL1',
  'La Liga': 'PD',
  'Serie A': 'SA',
  'Ligue 1': 'FL1',
} as const;

export type CompetitionCode = typeof COMPETITION_CODES[keyof typeof COMPETITION_CODES];
