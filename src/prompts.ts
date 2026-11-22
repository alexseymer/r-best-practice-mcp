/**
 * Guided project creation. Each prompt tells the client's assistant which questions to ask the
 * user and how to call create_project with the answers. The assistant writes the returned files.
 */
import type { Prompt, GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

interface GuidedPrompt {
  name: string;
  description: string;
  /** Project type passed to create_project; `format` picks it when given. */
  type: string;
  label: string;
  arguments?: Prompt['arguments'];
}

const GUIDED_PROMPTS: GuidedPrompt[] = [
  {
    name: 'neues-r-paket',
    description: 'Neues R-Paket mit Standardstruktur anlegen (DESCRIPTION, tests, Dokumentation)',
    type: 'package',
    label: 'R-Paket',
  },
  {
    name: 'neue-shiny-app',
    description: 'Neue Shiny-App mit modularer Struktur anlegen',
    type: 'shiny',
    label: 'Shiny-App',
  },
  {
    name: 'neues-quarto-projekt',
    description: 'Neues Quarto- oder R-Markdown-Dokumentprojekt anlegen',
    type: 'quarto',
    label: 'Quarto- oder R-Markdown-Projekt',
    arguments: [
      {
        name: 'format',
        description: 'quarto (Standard) oder rmarkdown',
        required: false,
      },
    ],
  },
  {
    name: 'neue-datenanalyse',
    description: 'Neues Datenanalyse-Projekt mit Ordnerstruktur und renv anlegen',
    type: 'analysis',
    label: 'Datenanalyse-Projekt',
  },
];

export const PROMPTS: Prompt[] = GUIDED_PROMPTS.map(({ name, description, arguments: args }) => ({
  name,
  description,
  arguments: args,
}));

export function getPrompt(name: string, args: Record<string, string> = {}): GetPromptResult | undefined {
  const guided = GUIDED_PROMPTS.find((p) => p.name === name);
  if (!guided) return undefined;

  const type = guided.name === 'neues-quarto-projekt' && args.format === 'rmarkdown' ? 'rmarkdown' : guided.type;

  const text = [
    `Lege ein neues ${guided.label} an.`,
    '',
    '1. Frage den Nutzer nach dem Projektnamen. Bei einem Paket sind Buchstaben, Ziffern und Punkte erlaubt, und der Name beginnt mit einem Buchstaben.',
    '2. Frage nach dem Autorennamen und optional nach der E-Mail-Adresse.',
    `3. Rufe das Tool create_project mit type="${type}" und den Antworten auf.`,
    '4. Liefert die Antwort den Code NEEDS_INPUT, stelle die genannten Fragen und rufe das Tool danach erneut auf.',
    '5. Schreibe jede zurückgegebene Datei relativ zum Zielordner. Frage nach dem Zielordner, wenn er nicht klar ist. Lege nur die gelieferten Dateien an.',
    '6. Überschreibe keine bestehenden Dateien ohne Rückfrage an den Nutzer.',
    '7. Fasse am Ende zusammen, was angelegt wurde, und nenne den nächsten Schritt.',
  ].join('\n');

  return {
    description: guided.description,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
