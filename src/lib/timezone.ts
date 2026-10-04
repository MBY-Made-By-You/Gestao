/**
 * Fuso horário da equipe. O servidor (Vercel) roda em UTC e o navegador no
 * fuso do usuário; formatando sempre em America/Sao_Paulo, servidor e cliente
 * produzem o mesmo texto (sem divergência de hidratação nem horas trocadas).
 */
export const APP_TIME_ZONE = "America/Sao_Paulo";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** yyyy-MM-dd */
  ymd: string;
  /** HH:mm */
  hm: string;
};

export function zonedParts(value: Date | string | number): ZonedParts {
  const date = value instanceof Date ? value : new Date(value);
  const map: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) map[part.type] = part.value;
  const hour = Number(map.hour) % 24;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
    ymd: `${map.year}-${map.month}-${map.day}`,
    hm: `${String(hour).padStart(2, "0")}:${map.minute}`,
  };
}

/**
 * Date "de parede": um Date local cujos componentes (dia, hora…) são os do fuso
 * da equipe. Use só para FORMATAR (date-fns format), nunca para comparar instantes.
 */
export function toWallClock(value: Date | string | number): Date {
  const p = zonedParts(value);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/** Diferença (min) entre o fuso da equipe e UTC no instante informado (ex.: -180). */
function offsetMinutes(at: Date): number {
  const p = zonedParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** "2026-10-04" + "14:30" (horário de Brasília) → ISO UTC. */
export function wallTimeToIso(ymd: string, hm = "00:00"): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
  const offset = offsetMinutes(new Date(guess));
  return new Date(guess - offset * 60000).toISOString();
}

/** Hoje (yyyy-MM-dd) no fuso da equipe. */
export function todayYmd(now: Date = new Date()): string {
  return zonedParts(now).ymd;
}
