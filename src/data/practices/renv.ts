import { Practice } from '../../types/practice.js';

export const renvPractices: Practice[] = [
  {
    id: 'renv-init',
    title: 'Initialize renv for reproducibility',
    workflow: 'renv',
    category: 'dependency',
    severity: 'important',
    enforcement: 'automated',
    description: 'Run renv::init() at project start',
    details:
      'renv::init() creates a private package library for the project, writes renv.lock and adds renv/activate.R plus a line in .Rprofile so that every R session starts with that library. Run it once at the start of the project. The automated check reports a project that has an renv.lock file but no renv/activate.R file, which usually means the lockfile was copied without the rest of the renv setup.',
    badExample: `my-project/
  renv.lock
  analysis.R
  # renv/ and .Rprofile are missing,
  # so R uses the global library`,
    goodExample: `# In the console, once per project
renv::init()

my-project/
  .Rprofile        # source("renv/activate.R")
  renv.lock
  renv/
    activate.R
    settings.json
  analysis.R`,
    tags: ['renv', 'initialization'],
    references: [
      'https://rstudio.github.io/renv/articles/renv.html',
      'https://rstudio.github.io/renv/reference/init.html',
    ],
  },
  {
    id: 'renv-lock',
    title: 'Track renv.lock in version control',
    workflow: 'renv',
    category: 'structure',
    severity: 'critical',
    enforcement: 'automated',
    description: 'Commit renv.lock to git for reproducible environments',
    details:
      'The lockfile records the exact version and source of every package, so collaborators and servers can recreate the same environment. Commit renv.lock together with renv/activate.R, renv/settings.json and .Rprofile, but ignore the renv/library directory (renv creates the needed .gitignore itself). The automated check only verifies that renv.lock exists in the project root; it does not inspect git.',
    badExample: `# .gitignore
renv.lock
renv/

# collaborators cannot reproduce the environment`,
    goodExample: `# .gitignore (written by renv::init())
renv/library/
renv/local/
renv/staging/

# Commit the lockfile
git add renv.lock renv/activate.R renv/settings.json .Rprofile
git commit -m "Update renv lockfile"`,
    tags: ['renv', 'vcs'],
    references: ['https://rstudio.github.io/renv/articles/collaborating.html'],
  },
  {
    id: 'renv-snapshot',
    title: 'Use renv::snapshot() to update dependencies',
    workflow: 'renv',
    category: 'structure',
    severity: 'important',
    enforcement: 'guidance',
    description: 'Always snapshot after installing new packages',
    details:
      'renv::snapshot() records the packages your project code actually uses in renv.lock. Run it after you install or update a package and before you commit, so the lockfile never lags behind the code. This is guidance only; the validator does not compare the lockfile against the installed library or your scripts.',
    badExample: `# Install a package but forget to record it
renv::install("dplyr")
# renv.lock does not list dplyr, so teammates
# get an error when they run the project`,
    goodExample: `renv::install("dplyr")
# use the package in your code, then record it
renv::status()
renv::snapshot()

# commit the changed lockfile
# git commit -am "Add dplyr"`,
    tags: ['renv', 'workflow'],
    references: ['https://rstudio.github.io/renv/reference/snapshot.html'],
  },
  {
    id: 'renv-restore',
    title: 'Use renv::restore() to initialize environment',
    workflow: 'renv',
    category: 'dependency',
    severity: 'important',
    enforcement: 'guidance',
    description: 'New users run renv::restore() to install exact versions',
    details:
      'After cloning a project, renv::restore() installs the exact package versions recorded in renv.lock into the project library. Document this step in the README and use the same command in continuous integration. This is guidance only; the validator cannot tell whether the library is in sync with the lockfile.',
    badExample: `# New collaborator installs whatever is latest
install.packages(c("dplyr", "ggplot2"))
# versions differ from the original analysis`,
    goodExample: `# After cloning the repository
# (renv bootstraps itself via .Rprofile)
renv::restore()

# Check that library and lockfile agree
renv::status()`,
    tags: ['renv', 'setup'],
    references: [
      'https://rstudio.github.io/renv/reference/restore.html',
      'https://rstudio.github.io/renv/articles/collaborating.html',
    ],
  },
];
