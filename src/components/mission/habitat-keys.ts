export const HAB_KEYS = ["iss", "moon", "mars", "eva", "earth"] as const;

export function habitatKeyFromParam(param?: string, scenarioHabitat?: string): (typeof HAB_KEYS)[number] {
  const p = (param ?? "").toLowerCase();
  const direct: Record<string, (typeof HAB_KEYS)[number]> = {
    iss: "iss", spacecraft: "iss", moon: "moon", moon_base: "moon", lunar: "moon", lunar_habitat: "moon", rover: "moon",
    mars: "mars", mars_habitat: "mars", eva: "eva", suit: "eva", earth: "earth", submarine: "earth",
  };
  return direct[p] ?? direct[(scenarioHabitat ?? "").toLowerCase()] ?? "iss";
}

