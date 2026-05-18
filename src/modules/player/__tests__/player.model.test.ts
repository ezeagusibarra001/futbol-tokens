import { Player } from "../player.model";

describe('Player mongoose model', () => {
    it('should default numeric stats to 0 on a new document', () => {
        const doc = new Player({ name: 'John Doe', league: 'Premier League', team: 'Arsenal' });
        expect(doc.name).toBe('John Doe');
        expect(doc.league).toBe('Premier League');
        expect(doc.team).toBe('Arsenal');
        expect(doc.goals).toBe(0);
        expect(doc.assists).toBe(0);
        expect(doc.shots).toBe(0);
        expect(doc.keyPasses).toBe(0);
        expect(doc.dribbles).toBe(0);
        expect(doc.tackles).toBe(0);
        expect(doc.rating).toBe(0);
        expect(doc.minutesPlayed).toBe(0);
        expect(doc.yellowCards).toBe(0);
        expect(doc.redCards).toBe(0);
    });

    it('should fail validation without required fields', async () => {
        const doc = new Player({ name: 'No League' });
        await expect(doc.validate()).rejects.toThrow();
    });

    it('should accept provided stat values', () => {
        const doc = new Player({
            name: 'Mbappe',
            position: 'FW',
            league: 'Ligue 1',
            team: 'PSG',
            goals: 10,
            assists: 5,
            rating: 8.1,
        });
        expect(doc.goals).toBe(10);
        expect(doc.assists).toBe(5);
        expect(doc.rating).toBe(8.1);
    });
});
