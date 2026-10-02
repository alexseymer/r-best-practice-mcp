import { rScriptPractices } from './r-script.js';
import { quartoPractices } from './quarto.js';
import { rmarkdownPractices } from './rmarkdown.js';
import { shinyPractices } from './shiny.js';
import { packagePractices } from './package.js';
import { renvPractices } from './renv.js';
import { targetsPractices } from './targets.js';
import { plumberPractices } from './plumber.js';
import { analysisPractices } from './analysis.js';
import { bookdownPractices } from './bookdown.js';
import { blogdownPractices } from './blogdown.js';
import { shinytestPractices } from './shinytest.js';
import { Practice } from '../../types/practice.js';

export const ALL_PRACTICES: Practice[] = [
  ...rScriptPractices,
  ...quartoPractices,
  ...rmarkdownPractices,
  ...shinyPractices,
  ...packagePractices,
  ...renvPractices,
  ...targetsPractices,
  ...plumberPractices,
  ...analysisPractices,
  ...bookdownPractices,
  ...blogdownPractices,
  ...shinytestPractices,
];
