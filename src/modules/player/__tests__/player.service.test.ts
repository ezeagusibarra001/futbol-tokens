import { listPlayers, getPlayerById, syncCatalogFromFootballData, syncPlayersFromScrapperFromTeamAndLeague } from "../player.service";
import * as repo from "../player.repository";
import * as scrapper from "../player.scrapper";
import * as fd from "../../integrations/football-data/football-data.client";
import { cache } from "../../../config/cache";

jest.mock('../player.repository');
jest.mock('../player.scrapper');
jest.mock('../../integrations/football-data/football-data.client');
jest.mock('../../market/market.service', () => ({
    ensureInitialHoldingsForAllPlayers: jest.fn().mockResolvedValue(0),
}));

beforeEach(() => cache.clear());

beforeEach(() => jest.clearAllMocks());

describe('player.service', () => {
    it('listPlayers forwards filters to repository', async () => {
        const mock = [{ name: 'A' }];
        (repo.findPlayers as jest.Mock).mockResolvedValue(mock);
        const res = await listPlayers({ league: 'Premier League', team: 'Arsenal' });
        expect(repo.findPlayers).toHaveBeenCalledWith({ league: 'Premier League', team: 'Arsenal' });
        expect(res).toEqual(mock);
    });

    it('getPlayerById delegates to repository', async () => {
        const mock = { _id: '1', name: 'A' };
        (repo.findPlayerById as jest.Mock).mockResolvedValue(mock);
        const res = await getPlayerById('1');
        expect(repo.findPlayerById).toHaveBeenCalledWith('1');
        expect(res).toEqual(mock);
    });

    it('listPlayers caches results and short-circuits on a second call with same filters', async () => {
        (repo.findPlayers as jest.Mock).mockResolvedValue([{ name: 'A' }]);
        await listPlayers({ league: 'Premier League' });
        await listPlayers({ league: 'Premier League' });
        expect(repo.findPlayers).toHaveBeenCalledTimes(1);
    });

    it('syncPlayersFromScrapper invalidates the players cache', async () => {
        (repo.findPlayers as jest.Mock).mockResolvedValue([{ name: 'A' }]);
        (scrapper.getPlayersFromTeamAndLeague as jest.Mock).mockResolvedValue([]);
        (repo.bulkUpsertPlayers as jest.Mock).mockResolvedValue(0);

        await listPlayers({ league: 'L' });
        await syncPlayersFromScrapperFromTeamAndLeague('L', 'T');
        await listPlayers({ league: 'L' });

        expect(repo.findPlayers).toHaveBeenCalledTimes(2);
    });

    it('syncCatalogFromFootballData fetches then bulk-upserts', async () => {
        const fetched = [{ externalId: 'fd:1', name: 'A', league: 'Premier League', team: 'Arsenal' }];
        (fd.fetchPlayersByCompetition as jest.Mock).mockResolvedValue(fetched);
        (repo.bulkUpsertPlayers as jest.Mock).mockResolvedValue(1);
        const count = await syncCatalogFromFootballData('PL');
        expect(fd.fetchPlayersByCompetition).toHaveBeenCalledWith('PL');
        expect(repo.bulkUpsertPlayers).toHaveBeenCalledWith(fetched);
        expect(count).toBe(1);
    });

    it('syncPlayersFromScrapper scrapes then bulk-upserts', async () => {
        const scraped = [{ name: 'A', league: 'X', team: 'Y' }];
        (scrapper.getPlayersFromTeamAndLeague as jest.Mock).mockResolvedValue(scraped);
        (repo.bulkUpsertPlayers as jest.Mock).mockResolvedValue(1);
        const count = await syncPlayersFromScrapperFromTeamAndLeague('X', 'Y');
        expect(scrapper.getPlayersFromTeamAndLeague).toHaveBeenCalledWith('X', 'Y');
        expect(repo.bulkUpsertPlayers).toHaveBeenCalledWith(scraped);
        expect(count).toBe(1);
    });
});
