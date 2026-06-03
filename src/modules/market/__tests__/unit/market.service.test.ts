import { Types } from 'mongoose';
import { ensureInitialHoldingsForPlayers, ensureInitialHoldingsForAllPlayers, INITIAL_TOKENS_PER_PLAYER } from '../../market.service';
import * as holdingRepo from '../../holding.repository';
import { User } from '../../../auth/user.model';
import { Player } from '../../../player/player.model';

jest.mock('../../holding.repository');

beforeEach(() => jest.clearAllMocks());

describe('market.service', () => {
    it('ensureInitialHoldingsForPlayers throws when no superuser exists', async () => {
        jest.spyOn(User, 'findOne').mockReturnValueOnce({ exec: () => Promise.resolve(null) } as unknown as ReturnType<typeof User.findOne>);
        await expect(ensureInitialHoldingsForPlayers([new Types.ObjectId()])).rejects.toMatchObject({ status: 500 });
    });

    it('ensureInitialHoldingsForPlayers calls bulkEnsureHoldings with 100 tokens', async () => {
        const su = { _id: new Types.ObjectId() };
        jest.spyOn(User, 'findOne').mockReturnValueOnce({ exec: () => Promise.resolve(su) } as unknown as ReturnType<typeof User.findOne>);
        (holdingRepo.bulkEnsureHoldings as jest.Mock).mockResolvedValue(2);
        const ids = [new Types.ObjectId(), new Types.ObjectId()];

        const created = await ensureInitialHoldingsForPlayers(ids);

        expect(holdingRepo.bulkEnsureHoldings).toHaveBeenCalledWith(su._id, ids, INITIAL_TOKENS_PER_PLAYER);
        expect(created).toBe(2);
    });

    it('ensureInitialHoldingsForPlayers short-circuits on empty input', async () => {
        const created = await ensureInitialHoldingsForPlayers([]);
        expect(created).toBe(0);
        expect(holdingRepo.bulkEnsureHoldings).not.toHaveBeenCalled();
    });

    it('ensureInitialHoldingsForAllPlayers reads players and forwards', async () => {
        const su = { _id: new Types.ObjectId() };
        jest.spyOn(User, 'findOne').mockReturnValueOnce({ exec: () => Promise.resolve(su) } as unknown as ReturnType<typeof User.findOne>);
        const ids = [new Types.ObjectId()];
        jest.spyOn(Player, 'find').mockReturnValueOnce({
            select: () => ({ lean: () => ({ exec: () => Promise.resolve(ids.map(_id => ({ _id }))) }) }),
        } as unknown as ReturnType<typeof Player.find>);
        (holdingRepo.bulkEnsureHoldings as jest.Mock).mockResolvedValue(1);

        const created = await ensureInitialHoldingsForAllPlayers();
        expect(created).toBe(1);
    });
});
