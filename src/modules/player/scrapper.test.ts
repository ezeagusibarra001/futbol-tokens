import { getPlayersFromTeamAndLeague } from "./player.scrapper"

const run = async () => {
  const league = process.argv[2] || "Liga Profesional";
  const team = process.argv[3] || "Boca Juniors";

  console.log("Buscando:", league);

  const link = await getPlayersFromTeamAndLeague(league, team);

  console.log("Resultado:", link);
};

run();