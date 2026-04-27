import { Player } from "../player.model";

describe('Player model', () => {
    it('should create a Player instance with default values', () => {
        const player = new Player({});
        expect(player.name).toBe('');
        expect(player.position).toBe('');
        expect(player.goals).toBe(0);
        expect(player.assists).toBe(0);
        expect(player.shots).toBe(0);
        expect(player.keyPasses).toBe(0);
        expect(player.dribbles).toBe(0);
        expect(player.tackles).toBe(0);
        expect(player.rating).toBe(0);
    });

    it('should create a Player instance with provided values', () => {
        const playerData = {
            name: 'John Doe',
            position: 'Forward',
            goals: 10,
            assists: 5,
            shots: 20,
            keyPasses: 3,
            dribbles: 7,
            tackles: 2,
            rating: 7.5,
        };
        const player = new Player(playerData);
        expect(player.name).toBe(playerData.name);
        expect(player.position).toBe(playerData.position);
        expect(player.goals).toBe(playerData.goals);
        expect(player.assists).toBe(playerData.assists);
        expect(player.shots).toBe(playerData.shots);
        expect(player.keyPasses).toBe(playerData.keyPasses);
        expect(player.dribbles).toBe(playerData.dribbles);
        expect(player.tackles).toBe(playerData.tackles);
        expect(player.rating).toBe(playerData.rating);
    });
});
