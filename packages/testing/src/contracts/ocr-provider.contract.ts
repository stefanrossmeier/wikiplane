import type { OcrProvider } from '@wikiplane/application';

export async function exerciseOcrProviderContract(provider: OcrProvider, imagePath: string): Promise<void> {
  const result = await provider.transcribe({ imagePath, prompt: 'Transcribe this fixture.' });
  if (typeof result.text !== 'string') throw new Error('OcrProvider must return string text');
}
