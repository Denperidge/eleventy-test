import test from "ava";
import { JSDOM } from "jsdom";
import { buildScenarios } from "./../../dist/index.js";

const results = await buildScenarios(cwd());
results
