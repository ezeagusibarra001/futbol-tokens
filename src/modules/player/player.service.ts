import { getPlayersFromTeamAndLeague } from "./player.scrapper";

export const getPlayers = async (league: string, team: string, position?: string) => {
    let players = await getPlayersFromTeamAndLeague(league, team, position);
    return Array.from(players).filter(p => {
        if (!position) return true;
        return p.position?.toLowerCase() === position.toLowerCase();
    });
};