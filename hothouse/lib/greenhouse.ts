const GREENHOUSE_AUTH_KEY = process.env.GREENHOUSE_AUTH_KEY;

if (!GREENHOUSE_AUTH_KEY) {
	throw new Error(
		"GREENHOUSE_AUTH_KEY is not set. You can create a 'k8s/_overlays/dev/secrets/secrets.plain' file with the key.",
	);
}

export function greenhouse(path: string) {
	return fetch(`https://harvest.greenhouse.io/v1/${path}`, {
		headers: {
			Authorization: `Basic ${Buffer.from(`${GREENHOUSE_AUTH_KEY}:`).toString("base64")}`,
		},
	});
}
