import { Types } from 'mongoose';
import { Holding } from '../../holding.model';
import { Order } from '../../order.model';

describe('Holding model', () => {
    it('defaults tokens and avgBuyPrice to 0', () => {
        const h = new Holding({ userId: new Types.ObjectId(), playerId: new Types.ObjectId() });
        expect(h.tokens).toBe(0);
        expect(h.avgBuyPrice).toBe(0);
    });

    it('rejects negative tokens', async () => {
        const h = new Holding({ userId: new Types.ObjectId(), playerId: new Types.ObjectId(), tokens: -1 });
        await expect(h.validate()).rejects.toThrow();
    });
});

describe('Order model', () => {
    it('requires side enum and positive tokens', async () => {
        const o = new Order({
            userId: new Types.ObjectId(),
            playerId: new Types.ObjectId(),
            side: 'INVALID',
            tokens: 0,
            pricePerToken: 1,
            total: 0,
        });
        await expect(o.validate()).rejects.toThrow();
    });

    it('validates a well-formed BUY order', async () => {
        const o = new Order({
            userId: new Types.ObjectId(),
            playerId: new Types.ObjectId(),
            side: 'BUY',
            tokens: 5,
            pricePerToken: 2,
            total: 10,
        });
        await expect(o.validate()).resolves.toBeUndefined();
    });
});
