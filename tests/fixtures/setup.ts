import fs from 'fs';
import path from 'path';

export const createTempDir = (): string => {
  const tempDir = path.join(process.cwd(), 'tests', '.temp', `test-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
};

export const cleanupTempDir = (dir: string): void => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

export const createFile = (dir: string, filename: string, content: string): string => {
  const filePath = path.join(dir, filename);
  const fileDir = path.dirname(filePath);
  fs.mkdirSync(fileDir, { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
};

export const createDir = (dir: string, dirname: string): string => {
  const dirPath = path.join(dir, dirname);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
};

// Fixture creators for different workflow types
export const createShinyFixture = (dir: string): void => {
  createFile(dir, 'app.R', 'library(shiny)\nui <- fluidPage()\nserver <- function(input, output) {}\nshinyApp(ui, server)');
};

export const createQuartoFixture = (dir: string): void => {
  createFile(
    dir,
    'analysis.qmd',
    '---\ntitle: "Analysis"\nauthor: "Test"\nformat: html\n---\n\n```{r}\nprint("Hello")\n```'
  );
};

export const createRScriptFixture = (dir: string): void => {
  createFile(dir, 'script.R', '#!/usr/bin/env Rscript\n# Purpose: Test script\nprint("Hello")');
};

export const createPackageFixture = (dir: string): void => {
  // Create DESCRIPTION file in the main directory
  const descPath = `${dir}/DESCRIPTION`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(descPath, 'Package: testpkg\nVersion: 0.1.0\nTitle: Test Package');

  // Create R directory
  const rDir = `${dir}/R`;
  fs.mkdirSync(rDir, { recursive: true });
  fs.writeFileSync(`${rDir}/hello.R`, '#\' Hello\n#\' @export\nhello <- function() { print("Hello") }');
};

export const createRenvFixture = (dir: string): void => {
  createFile(dir, 'renv.lock', '{\n"R": {"Version": "4.0.0"},\n"Packages": {}\n}');
};

export const createTargetsFixture = (dir: string): void => {
  createFile(dir, '_targets.R', 'library(targets)\nlist(\n  tar_target(data, read.csv("data.csv"))\n)');
};

export const createPlumberFixture = (dir: string): void => {
  createFile(
    dir,
    'api.R',
    '#* @get /hello\nfunction() {\n  list(message = "Hello")\n}'
  );
};

export const createBookdownFixture = (dir: string): void => {
  createFile(dir, '_bookdown.yaml', 'book_filename: "my-book"\noutput_dir: "_book"');
  createFile(dir, 'index.Rmd', '---\ntitle: "My Book"\n---\n\n# Introduction\n\nWelcome to my book.');
  createDir(dir, 'chapters');
};

export const createBlogdownFixture = (dir: string): void => {
  createFile(dir, 'config.toml', 'baseURL = "https://example.com/"\ntitle = "My Blog"\ntheme = "hugo-academic"');
  createDir(dir, 'content');
  createDir(dir, 'themes');
  createFile(dir, 'content/post/_index.md', '---\ntitle: "Blog Posts"\n---\n\nAll blog posts.');
};

export const createShinytestFixture = (dir: string): void => {
  createFile(dir, 'app.R', 'library(shiny)\nui <- fluidPage()\nserver <- function(input, output) {}\nshinyApp(ui, server)');
  createDir(dir, 'tests/shinytest');
  createFile(dir, 'tests/shinytest/mytest.R', '# Shinytest recording');
};
