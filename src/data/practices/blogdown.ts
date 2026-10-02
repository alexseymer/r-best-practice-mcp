import { Practice } from '../../types/practice.js';

export const blogdownPractices: Practice[] = [
  {
    id: 'blogdown-config',
    title: 'Configure site with config.toml or config.yaml',
    workflow: 'blogdown',
    category: 'structure',
    severity: 'critical',
    enforcement: 'automated',
    description: 'Set baseURL, title, theme, and menu configuration',
    details:
      'Hugo reads the site-wide settings (baseURL, title, theme, menus, taxonomies) from a single configuration file in the site root, and blogdown cannot build or serve the site without it. The check looks for config.toml or config.yaml in the project root and reports a critical finding when neither exists. Keep baseURL, title and theme set explicitly and add menu entries so navigation is defined in one place.',
    badExample: `my-site/
  content/
    post/
      2024-01-01-hello.md
  themes/
    hugo-lithium/
# no config.toml or config.yaml, so hugo cannot build the site`,
    goodExample: `# config.yaml
baseURL: https://example.com/
title: My R Blog
theme: hugo-lithium
languageCode: en-us
menu:
  main:
    - name: About
      url: /about/
      weight: 1
    - name: Posts
      url: /post/
      weight: 2`,
    tags: ['blogdown', 'configuration'],
    references: [
      'https://bookdown.org/yihui/blogdown/configuration.html',
      'https://bookdown.org/yihui/blogdown/',
    ],
  },
  {
    id: 'blogdown-content-structure',
    title: 'Organize posts in content/ directory',
    workflow: 'blogdown',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Use content/post/ for blog posts, maintain consistent structure',
    details:
      'Hugo only publishes pages that live under content/, and a consistent layout such as content/post/ for articles and content/about.md for static pages keeps URLs and list pages predictable. The check verifies that a content/ directory exists in the project root; it does not inspect how posts are arranged inside it. Use blogdown::new_post() so new posts land in the right folder with a dated, consistent file name.',
    badExample: `my-site/
  config.yaml
  posts/
    hello.md
  about.md
  # Hugo ignores posts/ and about.md because there is no content/ directory`,
    goodExample: `my-site/
  config.yaml
  content/
    _index.md
    about.md
    post/
      2024-01-01-hello-world.md
      2024-02-15-analysis.Rmd`,
    tags: ['blogdown', 'organization'],
    references: [
      'https://bookdown.org/yihui/blogdown/content.html',
      'https://bookdown.org/yihui/blogdown/',
    ],
  },
  {
    id: 'blogdown-theme',
    title: 'Choose and customize a Hugo theme',
    workflow: 'blogdown',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Select appropriate theme from Hugo themes, customize as needed',
    details:
      'A Hugo site needs a theme to turn content into HTML, and keeping the theme inside the project makes builds reproducible and lets you customize layouts safely. The check is a simple heuristic: it reports when there is no themes/ directory in the project root (sites that load a theme as a Hugo module may therefore see a false positive). Install a theme with blogdown::install_theme() and override templates in layouts/ rather than editing the theme itself.',
    badExample: `my-site/
  config.yaml      # theme key is missing
  content/
  # no themes/ directory, so the site renders without a theme`,
    goodExample: `# install a theme into themes/
blogdown::install_theme("yihui/hugo-lithium")

# config.yaml
theme: hugo-lithium

my-site/
  themes/hugo-lithium/
  layouts/partials/footer.html   # local override`,
    tags: ['blogdown', 'theme'],
    references: [
      'https://bookdown.org/yihui/blogdown/themes.html',
      'https://bookdown.org/yihui/blogdown/configuration.html',
    ],
  },
  {
    id: 'blogdown-metadata',
    title: 'Include YAML frontmatter in posts',
    workflow: 'blogdown',
    category: 'documentation',
    severity: 'important',
    enforcement: 'automated',
    description: 'Add title, date, author, categories, tags in post metadata',
    details:
      'Front matter gives Hugo each page title, date and taxonomy terms, which drive list pages, URLs and RSS feeds; a file without it is published with no title or date. The check scans .md, .Rmd and .Rmarkdown files under content/ (including _index.md) and reports files whose first line is not ---, +++ or a JSON brace; empty files are ignored. Create posts with blogdown::new_post() so the block is always generated.',
    badExample: `# Hello world

This post starts directly with content,
so Hugo has no title, date or tags for it.`,
    goodExample: `---
title: Hello World
author: Jane Doe
date: '2024-01-01'
categories:
  - R
tags:
  - blogdown
  - tutorial
---

This post starts with front matter.`,
    tags: ['blogdown', 'metadata'],
    references: [
      'https://gohugo.io/content-management/front-matter/',
      'https://bookdown.org/yihui/blogdown/content.html',
    ],
  },
  {
    id: 'blogdown-deployment',
    title: 'Configure deployment (Netlify, GitHub Pages)',
    workflow: 'blogdown',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Use netlify.toml or GitHub Actions for automated deployment',
    details:
      'Automated deployment makes publishing a push-to-deploy step and pins the Hugo version so the site builds the same way everywhere. The check passes when the project root has netlify.toml, vercel.json, render.yaml, .gitlab-ci.yml or a .netlify directory, or when .github/workflows/ contains any file. Netlify is the option recommended by the blogdown book; GitHub Pages works through an Actions workflow.',
    badExample: `my-site/
  config.yaml
  content/
  public/        # built locally and uploaded by hand
  # no netlify.toml and no .github/workflows/`,
    goodExample: `# netlify.toml
[build]
  publish = "public"
  command = "hugo"

[build.environment]
  HUGO_VERSION = "0.121.2"

[context.deploy-preview]
  command = "hugo --buildFuture -b $DEPLOY_PRIME_URL"`,
    tags: ['blogdown', 'deployment'],
    references: [
      'https://bookdown.org/yihui/blogdown/deployment.html',
      'https://bookdown.org/yihui/blogdown/netlify.html',
      'https://bookdown.org/yihui/blogdown/github-pages.html',
    ],
  },
];
