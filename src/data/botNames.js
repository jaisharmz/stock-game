import { BOTS } from "../engine/bots.js";

export const botName = (kind, i) => (i > 1 ? `${BOTS[kind].name} ${i}` : BOTS[kind].name);
