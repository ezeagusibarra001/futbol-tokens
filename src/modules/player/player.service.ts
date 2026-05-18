import { getPlayersFromTeamAndLeague } from "./player.scrapper";
import { bulkUpsertPlayers, findPlayerById, findPlayers, PlayerFilters } from "./player.repository";
import { IPlayerDoc } from "./player.model";
import { fetchPlayersByCompetition } from "../integrations/football-data/football-data.client";
import { CompetitionCode } from "../integrations/football-data/dto/football-data.dto";
import { ensureInitialHoldingsForAllPlayers } from "../market/market.service";

export const listPlayers = (filters: PlayerFilters): Promise<IPlayerDoc[]> => {
    return findPlayers(filters);
};

export const getPlayerById = (id: string): Promise<IPlayerDoc | null> => {
    return findPlayerById(id);
};

export const syncPlayersFromScrapper = async (league: string, team: string): Promise<number> => {
    const scraped = await getPlayersFromTeamAndLeague(league, team);
    const count = await bulkUpsertPlayers(scraped);
    await ensureInitialHoldingsForAllPlayers();
    return count;
};

export const syncCatalogFromFootballData = async (code: CompetitionCode): Promise<number> => {
    const players = await fetchPlayersByCompetition(code);
    const count = await bulkUpsertPlayers(players);
    await ensureInitialHoldingsForAllPlayers();
    return count;
};
