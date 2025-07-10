const GREENHOUSE_AUTH_KEY = process.env.GREENHOUSE_AUTH_KEY;

export function greenhouse(path: string) {
  if (!GREENHOUSE_AUTH_KEY) {
    throw new Error(
      "GREENHOUSE_AUTH_KEY is not set. You can create a 'k8s/_overlays/dev/secrets/secrets.plain' and/or a 'hothouse/.env' file with the key.",
    );
  }

  return fetch(`https://harvest.greenhouse.io/v1/${path}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${GREENHOUSE_AUTH_KEY}:`).toString("base64")}`,
    },
  });
}
