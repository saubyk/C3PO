import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { createCache } from "../cache.js";
import { NotFoundError } from "../errors.js";
import {
  listProjects,
  getProjectItems,
  type ProjectItem,
  type ProjectSummary,
} from "../github/projects.js";
import {
  loadRoster,
  loadDeveloperWorkload,
  type RosterResponse,
  type WorkloadResponse,
} from "../workload/service.js";

vi.mock("../github/projects.js", () => ({
  listProjects: vi.fn(),
  getProjectItems: vi.fn(),
}));

vi.mock("../github.js", () => ({
  fetchViewerLogin: vi.fn(),
}));

vi.mock("../workload/service.js", () => ({
  loadRoster: vi.fn(),
  loadDeveloperWorkload: vi.fn(),
}));

const mockedList = vi.mocked(listProjects);
const mockedItems = vi.mocked(getProjectItems);
const mockedRoster = vi.mocked(loadRoster);
const mockedWorkload = vi.mocked(loadDeveloperWorkload);

const PROJECTS: ProjectSummary[] = [
  {
    owner: "test-owner",
    number: 19,
    title: "lnd v0.22",
    url: "https://github.com/orgs/test-owner/projects/19",
  },
  {
    owner: "test-user",
    number: 1,
    title: "Personal sprint",
    url: "https://github.com/users/test-user/projects/1",
  },
];

const alice = { login: "alice", name: "Alice", avatarUrl: "https://x/a" };
const bob = { login: "bob", name: "Bob", avatarUrl: "https://x/b" };

const ITEMS: ProjectItem[] = [
  {
    id: "i1",
    contentType: "Issue",
    number: 1,
    title: "An issue",
    url: "https://github.com/x/y/issues/1",
    state: "OPEN",
    assignees: [alice],
    reviewers: [],
    fields: {
      Status: {
        kind: "single_select",
        optionName: "In progress",
        updatedAt: null,
      },
    },
  },
  {
    id: "i2",
    contentType: "PullRequest",
    number: 2,
    title: "A PR",
    url: "https://github.com/x/y/pull/2",
    state: "OPEN",
    assignees: [bob],
    reviewers: [alice],
    fields: {
      Status: {
        kind: "single_select",
        optionName: "In review",
        updatedAt: null,
      },
    },
  },
];

beforeAll(() => {
  process.env.GITHUB_TOKEN = "test-token";
  delete process.env.GITHUB_OWNER;
  process.env.LOG_LEVEL = "silent";
});

const ROSTER: RosterResponse = {
  orgs: ["lightningnetwork", "lightninglabs"],
  roster: [
    { login: "alice", avatarUrl: "https://x/a" },
    { login: "bob", avatarUrl: "https://x/b" },
  ],
  warnings: [],
  configErrors: [],
};

const WORKLOAD_ALICE: WorkloadResponse = {
  login: "alice",
  orgs: ["lightningnetwork", "lightninglabs"],
  assigned: [
    {
      kind: "Issue",
      repo: "lightningnetwork/lnd",
      number: 100,
      title: "Investigate flake in itest",
      url: "https://github.com/lightningnetwork/lnd/issues/100",
    },
    {
      kind: "PullRequest",
      repo: "lightningnetwork/lnd",
      number: 101,
      title: "Fix BOLT 12 parser edge case",
      url: "https://github.com/lightningnetwork/lnd/pull/101",
    },
  ],
  reviewing: [
    {
      kind: "PullRequest",
      repo: "lightningnetwork/lnd",
      number: 200,
      title: "Add fee bumping helper",
      url: "https://github.com/lightningnetwork/lnd/pull/200",
    },
  ],
  warnings: [],
};

beforeEach(() => {
  mockedList.mockReset();
  mockedItems.mockReset();
  mockedRoster.mockReset();
  mockedWorkload.mockReset();
  mockedList.mockResolvedValue(PROJECTS);
  mockedItems.mockResolvedValue(ITEMS);
  mockedRoster.mockResolvedValue(ROSTER);
  mockedWorkload.mockResolvedValue(WORKLOAD_ALICE);
});

function makeApp() {
  // Fresh cache per test so cache state doesn't leak across cases.
  return createApp({ cache: createCache() });
}

describe("/api/projects", () => {
  it("returns projects spanning multiple owners", async () => {
    const res = await request(makeApp()).get("/api/projects").expect(200);
    expect(res.body).toEqual(PROJECTS);
    expect(mockedList).toHaveBeenCalledTimes(1);
    expect(mockedList).toHaveBeenCalledWith("test-token");
  });

  it("serves the second call from cache", async () => {
    const app = makeApp();
    await request(app).get("/api/projects").expect(200);
    await request(app).get("/api/projects").expect(200);
    expect(mockedList).toHaveBeenCalledTimes(1);
  });

  it("?refresh=1 bypasses the cache", async () => {
    const app = makeApp();
    await request(app).get("/api/projects").expect(200);
    await request(app).get("/api/projects?refresh=1").expect(200);
    expect(mockedList).toHaveBeenCalledTimes(2);
  });
});

describe("/api/projects/:owner/:number/items", () => {
  it("returns the items list and forwards owner from the URL", async () => {
    const res = await request(makeApp())
      .get("/api/projects/test-owner/19/items")
      .expect(200);
    expect(res.body).toEqual(ITEMS);
    expect(mockedItems).toHaveBeenCalledWith("test-token", "test-owner", 19);
  });

  it("rejects an invalid project number with 400", async () => {
    const res = await request(makeApp())
      .get("/api/projects/test-owner/abc/items")
      .expect(400);
    expect(res.body.error).toMatch(/invalid project number/i);
    expect(mockedItems).not.toHaveBeenCalled();
  });

  it("rejects an invalid owner with 400", async () => {
    const res = await request(makeApp())
      .get("/api/projects/has--bad..chars/19/items")
      .expect(400);
    expect(res.body.error).toMatch(/invalid owner/i);
    expect(mockedItems).not.toHaveBeenCalled();
  });

  it("caches per (owner, number) — different owners don't collide", async () => {
    const app = makeApp();
    await request(app).get("/api/projects/owner-a/19/items").expect(200);
    await request(app).get("/api/projects/owner-b/19/items").expect(200);
    expect(mockedItems).toHaveBeenCalledTimes(2);
    expect(mockedItems).toHaveBeenNthCalledWith(1, "test-token", "owner-a", 19);
    expect(mockedItems).toHaveBeenNthCalledWith(2, "test-token", "owner-b", 19);
  });
});

describe("/api/projects/:owner/:number/team", () => {
  it("derives team members from items, sorted by total load desc", async () => {
    const res = await request(makeApp())
      .get("/api/projects/test-owner/19/team")
      .expect(200);
    expect(res.body).toEqual([
      { ...alice, assignedCount: 1, reviewingCount: 1 },
      { ...bob, assignedCount: 1, reviewingCount: 0 },
    ]);
  });

  it("shares the items cache so a sibling /items call doesn't refetch", async () => {
    const app = makeApp();
    await request(app).get("/api/projects/test-owner/19/items").expect(200);
    await request(app).get("/api/projects/test-owner/19/team").expect(200);
    expect(mockedItems).toHaveBeenCalledTimes(1);
  });
});

describe("/api/workload/roster", () => {
  it("returns the resolved roster", async () => {
    const res = await request(makeApp()).get("/api/workload/roster").expect(200);
    expect(res.body).toEqual(ROSTER);
    expect(mockedRoster).toHaveBeenCalledTimes(1);
    expect(mockedRoster).toHaveBeenCalledWith(
      "test-token",
      process.env.WORKLOAD_TEAMS,
      process.env.WORKLOAD_ORGS,
    );
  });

  it("serves the second call from cache", async () => {
    const app = makeApp();
    await request(app).get("/api/workload/roster").expect(200);
    await request(app).get("/api/workload/roster").expect(200);
    expect(mockedRoster).toHaveBeenCalledTimes(1);
  });

  it("?refresh=1 bypasses the cache", async () => {
    const app = makeApp();
    await request(app).get("/api/workload/roster").expect(200);
    await request(app).get("/api/workload/roster?refresh=1").expect(200);
    expect(mockedRoster).toHaveBeenCalledTimes(2);
  });
});

describe("/api/workload/:login", () => {
  it("returns the developer workload and forwards orgs from the cached roster", async () => {
    const res = await request(makeApp()).get("/api/workload/alice").expect(200);
    expect(res.body).toEqual(WORKLOAD_ALICE);
    expect(mockedWorkload).toHaveBeenCalledWith(
      "test-token",
      "alice",
      ROSTER.orgs,
    );
  });

  it("rejects an invalid login with 400", async () => {
    const res = await request(makeApp())
      .get("/api/workload/has--bad..chars")
      .expect(400);
    expect(res.body.error).toMatch(/invalid login/i);
    expect(mockedWorkload).not.toHaveBeenCalled();
  });

  it("shares the roster cache so a roster + login call resolves teams once", async () => {
    const app = makeApp();
    await request(app).get("/api/workload/roster").expect(200);
    await request(app).get("/api/workload/alice").expect(200);
    expect(mockedRoster).toHaveBeenCalledTimes(1);
  });

  it("caches per login — different logins don't collide", async () => {
    mockedWorkload
      .mockResolvedValueOnce(WORKLOAD_ALICE)
      .mockResolvedValueOnce({ ...WORKLOAD_ALICE, login: "bob" });
    const app = makeApp();
    await request(app).get("/api/workload/alice").expect(200);
    await request(app).get("/api/workload/bob").expect(200);
    expect(mockedWorkload).toHaveBeenCalledTimes(2);
  });
});

describe("error mapping", () => {
  it("translates a GitHub rate-limit error into HTTP 429 with resetAt", async () => {
    const reset = Math.floor(Date.now() / 1000) + 600;
    const err = Object.assign(new Error("API rate limit exceeded"), {
      status: 403,
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(reset),
      },
    });
    mockedItems.mockRejectedValueOnce(err);

    const res = await request(makeApp())
      .get("/api/projects/test-owner/19/items")
      .expect(429);
    expect(res.body.error).toMatch(/rate limit/i);
    expect(res.body.resetAt).toBe(new Date(reset * 1000).toISOString());
  });

  it("returns HTTP 502 for a generic upstream error", async () => {
    mockedItems.mockRejectedValueOnce(new Error("kaboom"));
    const res = await request(makeApp())
      .get("/api/projects/test-owner/19/items")
      .expect(502);
    expect(res.body.error).toBe("kaboom");
  });

  it("maps a NotFoundError thrown by the data layer to HTTP 404", async () => {
    mockedItems.mockRejectedValueOnce(
      new NotFoundError("Project #99999 not found for owner test-owner."),
    );
    const res = await request(makeApp())
      .get("/api/projects/test-owner/99999/items")
      .expect(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("maps a GraphQL NOT_FOUND error from upstream to HTTP 404", async () => {
    const err = Object.assign(
      new Error(
        "Request failed due to following response errors:\n - Could not resolve to a ProjectV2 with the number 99999.",
      ),
      {
        errors: [
          {
            type: "NOT_FOUND",
            message: "Could not resolve to a ProjectV2 with the number 99999.",
          },
        ],
      },
    );
    mockedItems.mockRejectedValueOnce(err);
    const res = await request(makeApp())
      .get("/api/projects/test-owner/99999/items")
      .expect(404);
    expect(res.body.error).toBe(
      "Could not resolve to a ProjectV2 with the number 99999.",
    );
  });
});
