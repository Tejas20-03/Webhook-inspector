import { customAlphabet } from "nanoid";

// lowercase alphanumeric, no ambiguous chars (0/o, 1/l), unguessable at 12 chars
const alphabet = "23456789abcdefghijkmnpqrstuvwxyz";
const generate = customAlphabet(alphabet, 12);

export function generateSlug(): string {
  return generate();
}
