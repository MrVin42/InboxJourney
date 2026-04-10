import { randomUUID } from "node:crypto";

import type { ScenarioRun, SiteAction } from "../domain/models.ts";

export interface ZillowScenarioDefinition {
  key: string;
  aliasKeys?: string[];
  description: string;
  market: string;
  searchFilters: Record<string, string | number>;
  plannedActions: Array<{
    type: SiteAction["type"];
    details: Record<string, string | number | boolean>;
  }>;
}

export const zillowScenarioLibrary: ZillowScenarioDefinition[] = [
  {
    key: "new-user-saved-search",
    aliasKeys: ["new-user", "new-user-saved-search"],
    description: "New Zillow user views homes, saves listings, and saves a search in one metro area.",
    market: "Seattle, WA",
    searchFilters: {
      minPrice: 650000,
      maxPrice: 950000,
      beds: 3,
      homeType: "single-family",
    },
    plannedActions: [
      {
        type: "search-performed",
        details: {
          query: "Seattle, WA",
          minPrice: 650000,
          maxPrice: 950000,
        },
      },
      {
        type: "listing-viewed",
        details: {
          listingId: "sea-101",
          rank: 1,
        },
      },
      {
        type: "listing-viewed",
        details: {
          listingId: "sea-102",
          rank: 2,
        },
      },
      {
        type: "listing-saved",
        details: {
          listingId: "sea-101",
        },
      },
      {
        type: "listing-saved",
        details: {
          listingId: "sea-103",
        },
      },
      {
        type: "search-saved",
        details: {
          label: "Seattle family homes",
        },
      },
    ],
  },
  {
    key: "return-visit-price-adjustment",
    aliasKeys: ["return-visit", "return-visit-price-adjustment"],
    description: "Returning user revisits Zillow, opens a few more listings, and widens the price filter.",
    market: "Seattle, WA",
    searchFilters: {
      minPrice: 700000,
      maxPrice: 1100000,
      beds: 3,
      homeType: "single-family",
    },
    plannedActions: [
      {
        type: "session-resumed",
        details: {
          dayOffset: 1,
        },
      },
      {
        type: "search-performed",
        details: {
          query: "Seattle, WA",
          minPrice: 700000,
          maxPrice: 1100000,
        },
      },
      {
        type: "listing-viewed",
        details: {
          listingId: "sea-201",
          rank: 1,
        },
      },
      {
        type: "listing-viewed",
        details: {
          listingId: "sea-202",
          rank: 2,
        },
      },
    ],
  },
];

export function findZillowScenarioDefinition(scenarioKey: string): ZillowScenarioDefinition | undefined {
  const normalizedKey = scenarioKey.toLowerCase();
  return zillowScenarioLibrary.find((definition) => {
    const keys = [definition.key, ...(definition.aliasKeys ?? [])].map((key) => key.toLowerCase());
    return keys.includes(normalizedKey);
  });
}

export function createScenarioRun(
  accountId: string,
  definition: ZillowScenarioDefinition,
  startedAt: string = new Date().toISOString(),
): ScenarioRun {
  return {
    id: randomUUID(),
    site: "zillow",
    scenarioKey: definition.key,
    accountId,
    startedAt,
    status: "planned",
    market: definition.market,
    notes: definition.description,
  };
}

export function materializeScenarioActions(
  runId: string,
  definition: ZillowScenarioDefinition,
  startedAtIso: string = new Date().toISOString(),
): SiteAction[] {
  const startedAt = new Date(startedAtIso).getTime();

  return definition.plannedActions.map((plannedAction, index) => ({
    id: randomUUID(),
    runId,
    type: plannedAction.type,
    occurredAt: new Date(startedAt + index * 60_000).toISOString(),
    details: plannedAction.details,
  }));
}
