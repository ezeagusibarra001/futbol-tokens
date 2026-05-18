export type PlayerDTO = {
    externalId?: string;
    name?: string;
    position?: string;
    league?: string;
    team?: string;
    goals: number;
    assists: number;
    shots: number;
    rating: number;
    dribbles?: number;
    tackles?: number;
    keyPasses?: number;
    minutesPlayed?: number;
    yellowCards?: number;
    redCards?: number;
};

export type PlayerStatKey =
    | "goals"
    | "assists"
    | "shots"
    | "keyPasses"
    | "dribbles"
    | "tackles"
    | "rating"
    | "minutesPlayed"
    | "yellowCards"
    | "redCards";
