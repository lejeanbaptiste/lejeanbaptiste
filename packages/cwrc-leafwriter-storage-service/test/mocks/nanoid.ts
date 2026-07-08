let counter = 0;

export const nanoid = () => `test-id-${counter++}`;

export const customAlphabet = () => nanoid;
