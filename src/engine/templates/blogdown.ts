import { TemplateFile, TemplateGeneratorOptions } from '../../types/template.js';

export function generateBlogdown(options: TemplateGeneratorOptions): {
  files: TemplateFile[];
  directories: string[];
} {
  const projectName = options.projectName || 'my-blog';

  return {
    files: [
      {
        path: 'config.yaml',
        content: `baseURL: "https://example.com/"
title: "${projectName}"
theme: "hugo-academic"

params:
  author: "${options.authorName || 'Your Name'}"
  email: "${options.authorEmail || 'email@example.com'}"

menu:
  main:
    - name: Home
      url: "#"
      weight: 1
    - name: Posts
      url: "post/"
      weight: 2
    - name: About
      url: "#about"
      weight: 3
`,
      },
      {
        path: 'content/_index.md',
        content: `---
title: "${projectName}"
---

Welcome to ${projectName}! This is your home page.
`,
      },
      {
        path: 'content/post/_index.md',
        content: `---
title: Blog Posts
---

All blog posts are listed below.
`,
      },
      {
        path: 'content/post/first-post.md',
        content: `---
title: "My First Post"
date: "${new Date().toISOString().split('T')[0]}"
author: "${options.authorName || 'Author Name'}"
---

# Welcome to My First Blog Post

This is your first blog post created with blogdown.

## Content

Write your blog post content here in Markdown format.

\`\`\`r
# R code examples
print("Hello from blogdown!")
\`\`\`

## More sections

Add as many sections as you need.
`,
      },
      {
        path: 'netlify.toml',
        content: `[build]
command = "hugo"
publish = "public"

[build.environment]
HUGO_VERSION = "latest"
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Blog created with blogdown and Hugo.

## Building the Blog

To preview locally:

\`\`\`r
blogdown::serve_site()
\`\`\`

To build static site:

\`\`\`r
blogdown::hugo_build()
\`\`\`

## Adding New Posts

\`\`\`r
blogdown::new_post("post-title")
\`\`\`

## Project Structure

- \`config.yaml\` - Site configuration
- \`content/\` - Content (posts, pages, etc.)
- \`themes/\` - Theme directory
- \`static/\` - Static files (CSS, JS, images)
- \`public/\` - Generated static site (in .gitignore)

## Requirements

- R >= 4.0.0
- blogdown package
- Hugo

## Deployment

Deploy to Netlify, GitHub Pages, or your own hosting.

See netlify.toml for Netlify configuration.
`,
      },
      {
        path: '.gitignore',
        content: `# Hugo
public/
resources/_gen/

# R
.Rhistory
.RData
.Rproj.user/
*.Rproj

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
`,
      },
    ],
    directories: ['content/post', 'themes', 'static'],
  };
}
