import { EXAMPLES, defaultParameters, sourceLines } from "../program-trace/examples.js";
import { cardMarkup } from "../program-trace/card-renderer.js";

process.stdout.write(EXAMPLES.map(entry => cardMarkup(entry, sourceLines(entry, defaultParameters(entry)))).join("\n"));
