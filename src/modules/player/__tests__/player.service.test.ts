import { getPlayersFromTeamAndLeague } from "../player.scrapper";
import { getPlayers } from "../player.service";

jest.mock('../player.scrapper', () => ({
    getPlayersFromTeamAndLeague: jest.fn(),
}));

beforeEach(() => {
    jest.clearAllMocks();
});

describe('player.service - getPlayers', () => {
    it('should return players from scrapper', async () => {
        const mockPlayers = [
            { name: 'Player 1', position: 'Forward' },
            { name: 'Player 2', position: 'Midfielder' },
        ];
        (getPlayersFromTeamAndLeague as jest.Mock).mockResolvedValue(mockPlayers);
        const result = await getPlayers('some_league', 'some_team');
        expect(getPlayersFromTeamAndLeague).toHaveBeenCalledWith('some_league', 'some_team');
        expect(result).toEqual(mockPlayers);
    });

    it('with position', async () => {
        const mockPlayers = [
            { name: 'Player 1', position: 'Forward' },
        ];
        (getPlayersFromTeamAndLeague as jest.Mock).mockResolvedValue([
            { name: 'Player 1', position: 'Forward' },
            { name: 'Player 2', position: 'Midfielder' },
        ]);
        const result = await getPlayers('some_league', 'some_team', 'Forward');
        expect(getPlayersFromTeamAndLeague).toHaveBeenCalledWith('some_league', 'some_team');
        expect(result).toEqual(mockPlayers);
    });
});

