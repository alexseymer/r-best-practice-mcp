import { TemplateFile, TemplateGeneratorOptions } from '../../types/template.js';

export function generateBookdown(options: TemplateGeneratorOptions): {
  files: TemplateFile[];
  directories: string[];
} {
  const projectName = options.projectName || 'my-book';

  return {
    files: [
      {
        path: '_bookdown.yaml',
        content: `book_filename: "${projectName}"
output_dir: "_book"
new_session: no
delete_merged_file: yes

language:
  ui:
    chapter_name: "Chapter "
`,
      },
      {
        path: 'index.Rmd',
        content: `---
title: "${projectName}"
author: "${options.authorName || 'Author Name'}"
date: "\`r Sys.Date()\`"
site: bookdown::bookdown_site
output:
  bookdown::gitbook: default
  bookdown::pdf_book: default
---

# Introduction {#intro}

Welcome to ${projectName}. This book was built with bookdown.

## How to read this book

This is a sample introduction chapter. Each chapter in this book is a \`.Rmd\` file.
`,
      },
      {
        path: '01-chapter.Rmd',
        content: `# Chapter 1: Getting Started

\`\`\`{r setup, include=FALSE}
knitr::opts_chunk$set(echo = TRUE)
\`\`\`

This is the first chapter.

## Section 1.1

\`\`\`{r}
# Code example
print("Hello from Chapter 1")
\`\`\`

## Section 1.2

More content here.
`,
      },
      {
        path: '02-chapter.Rmd',
        content: `# Chapter 2: Analysis

This is the second chapter.

## Analysis Results

Figure \\@ref(fig:plot-xy) shows the data.

\`\`\`{r plot-xy, fig.cap="A simple scatter plot"}
# Your analysis code here
x <- 1:10
y <- rnorm(10)
plot(x, y)
\`\`\`

## Summary

Summarize your findings.
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Bookdown project for creating a book.

## Building the Book

To build the HTML book:

\`\`\`r
bookdown::render_book("index.Rmd", "bookdown::gitbook")
\`\`\`

To build the PDF book:

\`\`\`r
bookdown::render_book("index.Rmd", "bookdown::pdf_book")
\`\`\`

## Project Structure

- \`index.Rmd\` - Introduction chapter
- \`01-chapter.Rmd\`, \`02-chapter.Rmd\`, etc. - Additional chapters
- \`_bookdown.yaml\` - Bookdown configuration
- \`_output.yml\` - Output format configuration (optional)

## Requirements

- R >= 4.0.0
- bookdown package
- rmarkdown package
`,
      },
      {
        path: '.gitignore',
        content: `# Output
_book/
_bookdown_files/
*.pdf
*.html

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
    directories: ['chapters'],
  };
}
