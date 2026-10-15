import { createInterface } from "node:readline/promises";
import { hashPassword } from "../src/server/crypto.ts";

const rl = createInterface({ input: process.stdin, output: process.stderr });
const pw = process.argv[2] ?? (await rl.question("Password (min 12 chars): "));
rl.close();
if (!pw || pw.length < 12) {
  console.error("Use at least 12 characters.");
  process.exit(1);
}
// Print the hash only; store it as APP_PASSWORD_HASH (server-side secret).
console.log(hashPassword(pw));
