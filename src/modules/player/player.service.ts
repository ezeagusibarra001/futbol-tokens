import { getPlayersFromTeamAndLeague } from "./player.scrapper";
import { bulkUpsertPlayers, findPlayerById, findPlayers, PlayerFilters } from "./player.repository";
import { IPlayerDoc } from "./player.model";
import { fetchPlayersByCompetition } from "../integrations/football-data/football-data.client";
import { CompetitionCode } from "../integrations/football-data/dto/football-data.dto";
import { ensureInitialHoldingsForAllPlayers } from "../market/market.service";
import { cache, CACHE_KEYS, TTL } from "../../config/cache";

const filtersKey = (f: PlayerFilters) =>
    `${CACHE_KEYS.playersListPrefix}${f.league ?? ''}|${f.team ?? ''}|${f.position ?? ''}`;

export const listPlayers = (filters: PlayerFilters): Promise<IPlayerDoc[]> => {
    return cache.wrap(filtersKey(filters), TTL.playersList, () => findPlayers(filters));
};

export const getPlayerById = (id: string): Promise<IPlayerDoc | null> => {
    return cache.wrap(`${CACHE_KEYS.playerByIdPrefix}${id}`, TTL.playerById, () => findPlayerById(id));
};

const invalidatePlayerCaches = () => {
    cache.invalidatePrefix(CACHE_KEYS.playersListPrefix);
    cache.invalidatePrefix(CACHE_KEYS.playerByIdPrefix);
    cache.invalidatePrefix(CACHE_KEYS.rankingPrefix);
};

export const syncPlayersFromScrapper = async (league: string, team: string): Promise<number> => {
    const scraped = await getPlayersFromTeamAndLeague(league, team);
    const count = await bulkUpsertPlayers(scraped);
    await ensureInitialHoldingsForAllPlayers();
    invalidatePlayerCaches();
    return count;
};

export const syncCatalogFromFootballData = async (code: CompetitionCode): Promise<number> => {
    const players = await fetchPlayersByCompetition(code);
    const count = await bulkUpsertPlayers(players);
    await ensureInitialHoldingsForAllPlayers();
    invalidatePlayerCaches();
    return count;
};
