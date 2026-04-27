import { getPlayersFromTeamAndLeague } from "./player.scrapper";

export const getPlayers = async (league: string, team: string, position?: string) => {
    return await getPlayersFromTeamAndLeague(league, team, position);
};