const fnvHash = (value: string, seed = 2166136261) => {
  let hash = seed >>> 0;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const makeIdGenerator = (seed: number) => {
  return (kind: string, name: string) => {
    const hash = fnvHash(`${seed}:${kind}:${name}`);
    return `${kind}-${hash.toString(36)}`;
  };
};

export const numericSeedFromId = (id: string) => fnvHash(id, 1234567);
