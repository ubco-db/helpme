import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function loadEssayFeedbackSystemPrompt(): string {
  const candidates = [
    join(__dirname, 'prompts', 'prompt.md'),
    join(__dirname, '..', 'prompts', 'prompt.md'),
    join(process.cwd(), 'dist', 'essay-feedback', 'prompts', 'prompt.md'),
    join(
      process.cwd(),
      'packages',
      'server',
      'dist',
      'essay-feedback',
      'prompts',
      'prompt.md',
    ),
    join(process.cwd(), 'src', 'essay-feedback', 'prompts', 'prompt.md'),
    join(
      process.cwd(),
      'packages',
      'server',
      'src',
      'essay-feedback',
      'prompts',
      'prompt.md',
    ),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return readFileSync(p, 'utf-8');
    }
  }
  throw new Error('Essay feedback prompt.md could not be loaded.');
}
