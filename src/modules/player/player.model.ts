
export interface IPlayer {
  nombre: string;
  position: string;
  goals: number;
  assists: number;
  shots: number;
  rating: number;
  keyPasses: number;
  dribbles: number;
  tackles: number;
}

export class Player implements IPlayer {
  nombre: string;
  position: string;
  goals: number;
  assists: number;
  shots: number;
  keyPasses: number;
  dribbles: number;
  tackles: number;
  rating: number;

  constructor(data: Partial<Player>) {
    this.nombre = data.nombre ?? "";
    this.position = data.position ?? "";
    this.goals = data.goals ?? 0;
    this.assists = data.assists ?? 0;
    this.shots = data.shots ?? 0;
    this.keyPasses = data.keyPasses ?? 0;
    this.dribbles = data.dribbles ?? 0;
    this.tackles = data.tackles ?? 0;
    this.rating = data.rating ?? 0;
  }
}