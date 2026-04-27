export type PlayerDTO = {
    name?: string;
    position?: string;
    goals: number;
    assists: number;
    shots: number;
    rating: number;
    dribbles?: number;
    tackles?: number;
    keyPasses?: number;
};

export type PlayerStatKey =
    | "goals"
    | "assists"
    | "shots"
    | "keyPasses"
    | "dribbles"
    | "tackles"
    | "rating";
