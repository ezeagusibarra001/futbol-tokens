import { getPlayersFromTeamAndLeague } from "./player.scrapper";
import { bulkUpsertPlayers, findPlayerById, findPlayers, PlayerFilters } from "./player.repository";
import { IPlayerDoc } from "./player.model";

export const listPlayers = (filters: PlayerFilters): Promise<IPlayerDoc[]> => {
    return findPlayers(filters);
};

export const getPlayerById = (id: string): Promise<IPlayerDoc | null> => {
    return findPlayerById(id);
};

export const syncPlayersFromScrapper = async (league: string, team: string): Promise<number> => {
    const scraped = await getPlayersFromTeamAndLeague(league, team);
    return bulkUpsertPlayers(scraped);
};
