import { listPlayers, getPlayerById, syncPlayersFromScrapper } from "../player.service";
import * as repo from "../player.repository";
import * as scrapper from "../player.scrapper";

jest.mock('../player.repository');
jest.mock('../player.scrapper');

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

    it('syncPlayersFromScrapper scrapes then bulk-upserts', async () => {
        const scraped = [{ name: 'A', league: 'X', team: 'Y' }];
        (scrapper.getPlayersFromTeamAndLeague as jest.Mock).mockResolvedValue(scraped);
        (repo.bulkUpsertPlayers as jest.Mock).mockResolvedValue(1);
        const count = await syncPlayersFromScrapper('X', 'Y');
        expect(scrapper.getPlayersFromTeamAndLeague).toHaveBeenCalledWith('X', 'Y');
        expect(repo.bulkUpsertPlayers).toHaveBeenCalledWith(scraped);
        expect(count).toBe(1);
    });
});
