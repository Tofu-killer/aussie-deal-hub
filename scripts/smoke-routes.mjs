const targets = [
  {
    name: "web-home-en",
    url: process.env.WEB_HOME_URL ?? "http://127.0.0.1:3000/en",
    expectedStatus: 200,
  },
  {
    name: "web-search-en",
    url: process.env.WEB_SEARCH_URL ?? "http://127.0.0.1:3000/en/search?q=switch",
    expectedStatus: 200,
  },
  {
    name: "admin-home",
    url: process.env.ADMIN_HOME_URL ?? "http://127.0.0.1:3002/",
    expectedStatus: 200,
  },
];

async function checkTarget(target) {
  const response = await fetch(target.url, {
    cache: "no-store",
  });

  if (response.status !== target.expectedStatus) {
    throw new Error(`${target.name} expected ${target.expectedStatus}, got ${response.status}`);
  }
}

async function main() {
  for (const target of targets) {
    await checkTarget(target);
  }
}

main().catch((error) => {
  console.error("Route smoke failed:", error);
  process.exitCode = 1;
});
