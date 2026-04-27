import { Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Player } from "./player.model";
import { PlayerDTO, PlayerStatKey  } from "./dto/player.dto";

puppeteer.use(StealthPlugin());


const preActions = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled"
    ]
  });

  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  await page.goto("https://www.whoscored.com/", {
    waitUntil: "networkidle2"
  });

  await page.waitForFunction(() => document.readyState === "complete");

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));

    const accept = buttons.find(b =>
      b.textContent?.toLowerCase().includes("accept") ||
      b.textContent?.toLowerCase().includes("aceptar")
    );

    if (accept) {
      (accept as HTMLElement).click();
    }
  });

  return { browser, page };
};

const findLink = async (page: Page, leagueName: string, querySelector: string) => {
  return await page.evaluate((leagueName: string, querySelector: string) => {
    const grid = document.querySelector(querySelector);
    if (!grid) return null;

    const links = grid.querySelectorAll("a");

    for (const el of links) {
      const text = el.textContent?.trim().toLowerCase();
      if (text && text.includes(leagueName.toLowerCase())) {
        return el.href;
      };
    }

    return null;
  }, leagueName, querySelector);
};

export const getPlayersFromTeamAndLeague = async (leagueName: string, team: string) => {
  const { browser, page } = await preActions();
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll("a, button"))
      .some(el => el.textContent?.toLowerCase().includes("tournament"));
  });

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("a, button"))
      .find(el => el.textContent?.toLowerCase().includes("tournament"));

    if (btn) (btn as HTMLElement).click();
  });

  await page.waitForFunction(() => {
    const visibleLinks = Array.from(document.querySelectorAll("a"))
      .filter(a => (a as HTMLElement).offsetParent !== null);

    return visibleLinks.length > 50;
  });


  const links = await page.$$("a");

  let tournamentLink: string | null = null;

  for (const link of links) {
    const text = await link.evaluate(el => el.textContent?.toLowerCase() || "");

    if (text.includes(leagueName.toLowerCase())) {
      tournamentLink = await link.evaluate(el => (el as HTMLAnchorElement).href);
      break;
    }
  }
  if (tournamentLink) {
    await page.goto(tournamentLink, { waitUntil: "networkidle2" });
  }

  await page.waitForSelector("table");
  const teamStatiscticLink = await findLink(page, "Team Statistics", "#sub-navigation");
  if (teamStatiscticLink) {
    await page.goto(teamStatiscticLink, { waitUntil: "networkidle2" });
  }

  await page.waitForSelector("table");
  const teamLink = await findLink(page, team, "table");
  if (teamLink) {
    await page.goto(teamLink, { waitUntil: "networkidle2" });
  }


  await page.evaluate((leagueName: string, querySelector: string) => {
    const grid = document.querySelector(querySelector);
    if (!grid) return null;

    const links = grid.querySelectorAll("a");

    for (const el of links) {
      const text = el.textContent?.trim().toLowerCase();
      if (text && text.includes(leagueName.toLowerCase())) {
        return el.href;
      };
    }

    return null;
  }, team, "table");


  const jugadoresData = await page.evaluate((): PlayerDTO[] => {
    const tables = Array.from(document.querySelectorAll("table"));
    const tablaJugadores = tables.find(table => {
      const header = table.innerText.toLowerCase();
      return header.includes("player");
    });

    if (!tablaJugadores) return [];

    const rows = tablaJugadores.querySelectorAll("tbody tr");

    return Array.from(rows).map(row => {
      const cols = row.querySelectorAll("td");

      return {
        name: cols[1]?.querySelector("a")?.textContent?.trim(),
        position: cols[1]
          ?.querySelector(".player-meta-data:last-of-type")
          ?.textContent
          ?.replace(/[,\s]/g, "")
          ?.trim(),
        goals: Number(cols[6]?.innerText || 0),
        assists: Number(cols[7]?.innerText || 0),
        shots: Number(cols[10]?.innerText || 0),
        rating: Number(cols[14]?.innerText || 0),
      };
    });
  });
  const jugadoresMap = new Map(
    jugadoresData
      .filter(j => j.name)
      .map(j => [j.name!.toLowerCase(), j])
  );

  const cambiarTipoEstadistica = async (
    tab: string,
    columnaEsperada: string
  ) => {
    await page.evaluate((tab: string) => {
      const container = document.querySelector("#team-squad-stats");
      if (!container) return;

      const tabs = Array.from(container.querySelectorAll("a, button"));

      const btn = tabs.find(el =>
        el.textContent?.toLowerCase().includes(tab.toLowerCase())
      );

      if (btn) (btn as HTMLElement).click();
    }, tab);

    await page.waitForFunction((columnaEsperada) => {
      const container = document.querySelector("#team-squad-stats");
      if (!container) return false;

      const headers = Array.from(
        container.querySelectorAll("table thead th")
      ).map(th => th.textContent?.toLowerCase());

      return headers.some(h => h?.includes(columnaEsperada.toLowerCase()));
    }, {}, columnaEsperada);
  };

  const agregarPorClase = async (campo: PlayerStatKey, className: string) => {
    const data = await page.evaluate((className) => {
      const container = document.querySelector("#team-squad-stats");
      if (!container) return [];

      const rows = container.querySelectorAll("table tbody tr");

      return Array.from(rows).map(row => {
        const nombre = row.querySelector("td:nth-child(2) a")
          ?.textContent?.trim();

        const valor = row.querySelector(`[class*="${className}"]`)
          ?.textContent?.trim();

        return {
          name: nombre,
          valor: Number(valor?.replace(/[^\d.]/g, "") || 0)
        };
      });
    }, className);

    for (const item of data) {
      if (!item.name) continue;

      const jugador = jugadoresMap.get(item.name.toLowerCase());

      if (jugador) {
        jugador[campo] = item.valor;
      }
    }
  };



  await cambiarTipoEstadistica("defensive", "tackles");
  await agregarPorClase("tackles", "tacklePerGame");

  await cambiarTipoEstadistica("offensive", "key");
  await agregarPorClase("keyPasses", "keyPassPerGame");

  await agregarPorClase("dribbles", "dribbleWonPerGame");

  const jugadores = jugadoresData.map(d =>
    new Player({
      name: d.name ?? "",
      position: d.position ?? "",
      goals: d.goals,
      assists: d.assists,
      shots: d.shots,
      rating: d.rating,
    })
  );

  await browser.close();
  return jugadores;

}


