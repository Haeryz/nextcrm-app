export const CUSTOMER_PASSWORD_GROUPS = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%&*?",
] as const;

export const DEFAULT_CUSTOMER_PASSWORD_LENGTH = 16;

type RandomIndex = (maxExclusive: number) => number;

function secureRandomIndex(maxExclusive: number) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("maxExclusive must be a positive integer");
  }

  const values = new Uint32Array(1);
  const range = 0x1_0000_0000;
  const unbiasedLimit = Math.floor(range / maxExclusive) * maxExclusive;
  let value = 0;
  do {
    globalThis.crypto.getRandomValues(values);
    value = values[0];
  } while (value >= unbiasedLimit);

  return value % maxExclusive;
}

export function generateRandomCustomerPassword(
  length = DEFAULT_CUSTOMER_PASSWORD_LENGTH,
  randomIndex: RandomIndex = secureRandomIndex,
) {
  const safeLength = Math.min(Math.max(Math.floor(length), 12), 64);
  const alphabet = CUSTOMER_PASSWORD_GROUPS.join("");
  const characters = CUSTOMER_PASSWORD_GROUPS.map(
    (group) => group[randomIndex(group.length)],
  );

  while (characters.length < safeLength) {
    characters.push(alphabet[randomIndex(alphabet.length)]);
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }

  return characters.join("");
}
